import FormData from "form-data";
import { BaseService } from "../base/base-service";
import { GitHubService } from "../github/github.service";
import { IApiClient, ILogger } from "../base/interfaces";
import * as core from "@actions/core";

import {
  AuthTokenResponse,
  BackupUploadResponse,
  OtpResponse,
  OtpStatusResponse,
  FileUploadData,
  ApiResponse,
  AuthTokenRequest,
  EndpointTagListRequest,
  EndpointTagListResponse,
  EndpointList,
  EndpointTagInsertResponse,
  EndpointTagInsertRequest,
} from "../../types/api";
import axios, { AxiosInstance } from "axios";
import { context } from "@actions/github";
import { ConfigService } from "../config/config.service";
import { ApiConfig } from "../../types/config";

export class ApiClientService extends BaseService implements IApiClient {
  private configService: ConfigService;
  private apiConfig: ApiConfig;
  private axiosInstance: AxiosInstance;

  constructor(logger: ILogger, configService: ConfigService) {
    super(logger);
    this.configService = configService;
    this.apiConfig = configService.getApiConfig();

    this.axiosInstance = axios.create({
      baseURL: this.apiConfig.baseUrl,
      timeout: this.apiConfig.timeout,
      headers: {
        "User-Agent": this.apiConfig.userAgent,
      },
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        this.handleAxiosError(error, "API request failed");
      }
    );
  }

  protected async onInitialize(): Promise<void> {}

  public async authenticate(
    activationCode: string
  ): Promise<AuthTokenResponse> {
    this.ensureInitialized();

    try {
      this.logger.info("Authenticating with iCredible API");

      const defaultToken = core.getInput("github-token", { required: true });
      const defaultTokenGitHubService = new GitHubService(
        this.logger,
        defaultToken,
        context.repo.owner,
        context.repo.repo,
        this.configService
      );

      await defaultTokenGitHubService.initialize();

      const activationDetails =
        await defaultTokenGitHubService.getRepositoryActivationDetails();
      const requestBody: AuthTokenRequest = {
        activationCode: activationCode,
        ...activationDetails,
      };

      const response = await this.axiosInstance.post(
        "/endpoint/activation",
        requestBody
      );

      const apiResponse: ApiResponse<AuthTokenResponse> = response.data;
      if (!apiResponse.success) {
        throw new Error(
          `Authentication failed: ${apiResponse.error || apiResponse.message}`
        );
      }
      await this.manageEndpointTag(
        apiResponse.data.endpointId,
        apiResponse.data.token
      );
      this.logger.info("Authentication successful");
      return apiResponse.data;
    } catch (error) {
      this.handleError(error, "Failed to authenticate with iCredible API");
    }
  }

  private async manageEndpointTag(
    endpointId: number,
    token: string
  ): Promise<void> {
    try {
      const repoName = context.repo.repo;
      this.logger.info(`Managing endpoint tag for repository: ${repoName}`);

      const existingTag = await this.findTagByName(repoName, token);

      if (!existingTag) {
        this.logger.info(`Tag '${repoName}' not found, creating new tag`);
        const newTag = await this.createEndpointTag(repoName, token);
        await this.addTagToEndpoint(endpointId, newTag.id, token);
        this.logger.info(`Tag '${repoName}' created and added to endpoint`);
      } else {
        this.logger.info(`Tag '${repoName}' found with ID: ${existingTag.id}`);
        const hasTag = await this.checkEndpointHasTag(
          endpointId,
          existingTag.id,
          token
        );

        if (hasTag) {
          this.logger.info(`Endpoint already has tag '${repoName}'`);
        } else {
          this.logger.info(`Adding existing tag '${repoName}' to endpoint`);
          await this.addTagToEndpoint(endpointId, existingTag.id, token);
          this.logger.info(`Tag '${repoName}' added to endpoint`);
        }
      }
    } catch (error) {
      this.logger.warn(`Tag management failed: ${String(error)}`);
    }
  }

  private async findTagByName(
    tagName: string,
    token: string
  ): Promise<{ id: number; name: string } | null> {
    try {
      this.logger.info("Fetching endpoint tags list");

      const requestBody: EndpointTagListRequest = {
        pagination: {
          currentPage: 1,
          maxRowsPerPage: 1000,
        },
        gridCriterias: {
          sortModel: [
            {
              propertyName: "name",
              order: "asc",
            },
          ],
        },
      };

      const response = await this.axiosInstance.post(
        "/endpointtag/list",
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const apiResponse: ApiResponse<EndpointTagListResponse> = response.data;
      if (!apiResponse.success) {
        throw new Error(
          `Failed to fetch tags: ${apiResponse.error || apiResponse.message}`
        );
      }

      const tags = apiResponse.data.list;
      const foundTag = tags.find(
        (tag) => tag.name.toLowerCase() === tagName.toLowerCase()
      );

      return foundTag ? { id: foundTag.id, name: foundTag.name } : null;
    } catch (error) {
      this.logger.warn(`Failed to fetch tags: ${String(error)}`);
      return null;
    }
  }

  private async checkEndpointHasTag(
    endpointId: number,
    tagId: number,
    token: string
  ): Promise<boolean> {
    try {
      this.logger.info(`Checking if endpoint ${endpointId} has tag ${tagId}`);

      const response = await this.axiosInstance.get(
        `/Endpoint/GetDetail/${endpointId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const apiResponse: ApiResponse<EndpointList> = response.data;
      if (!apiResponse.success) {
        throw new Error(
          `Failed to fetch endpoint: ${apiResponse.error || apiResponse.message}`
        );
      }

      const endpoint = apiResponse.data;
      const hasTag = endpoint.tags.some(
        (tag: any) => tag.tagId === tagId || tag.tag?.id === tagId
      );

      return hasTag || false;
    } catch (error) {
      this.logger.warn(`Failed to check endpoint tags: ${String(error)}`);
      return false;
    }
  }

  private async createEndpointTag(
    tagName: string,
    token: string
  ): Promise<EndpointTagInsertResponse> {
    try {
      this.logger.info(`Creating new tag: ${tagName}`);

      const requestBody: EndpointTagInsertRequest = {
        name: tagName,
        backgroundColor: "#27b9ddff",
      };

      const response = await this.axiosInstance.post(
        "/endpointtag/insert",
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const apiResponse: ApiResponse<EndpointTagInsertResponse> = response.data;
      if (!apiResponse.success) {
        throw new Error(
          `Failed to create tag: ${apiResponse.error || apiResponse.message}`
        );
      }

      this.logger.info(
        `Tag created successfully with ID: ${apiResponse.data.id}`
      );
      return apiResponse.data;
    } catch (error) {
      this.handleAxiosError(error, "Failed to create endpoint tag");
    }
  }

  private async addTagToEndpoint(
    endpointId: number,
    tagId: number,
    token: string
  ): Promise<void> {
    try {
      this.logger.info(`Adding tag ${tagId} to endpoint ${endpointId}`);

      const response = await this.axiosInstance.post(
        `/endpointtag/${endpointId}/${tagId}/add`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const apiResponse: ApiResponse<any> = response.data;
      if (!apiResponse.success) {
        throw new Error(
          `Failed to add tag to endpoint: ${apiResponse.error || apiResponse.message}`
        );
      }

      this.logger.info("Tag added to endpoint successfully");
    } catch (error) {
      this.handleAxiosError(error, "Failed to add tag to endpoint");
    }
  }

  public async uploadBackup(
    uploadData: FileUploadData,
    token: string
  ): Promise<BackupUploadResponse> {
    this.ensureInitialized();
    let lastLoggedPercent = 0;

    try {
      this.logger.info(`Uploading backup file: ${uploadData.fileName}`);

      const form = new FormData();

      form.append("file", uploadData.file, {
        filename: uploadData.fileName,
        contentType: "application/octet-stream",
      });

      form.append("Size", uploadData.size.toString());
      form.append(
        "CompressedFileSize",
        uploadData.compressedFileSize.toString()
      );
      form.append("Attributes", uploadData.attributes.toString());
      form.append("FileName", uploadData.fileName);
      form.append("CompressionEngine", uploadData.compressionEngine);
      form.append("CompressionLevel", uploadData.compressionLevel);
      form.append("FullPath", uploadData.fullPath);
      form.append("EncryptionType", uploadData.encryptionType);
      form.append("RevisionType", uploadData.revisionType.toString());

      form.append("MetaData[Event]", uploadData.metadata.event);
      form.append("MetaData[Ref]", uploadData.metadata.ref);
      form.append("MetaData[Actor]", uploadData.metadata.actor);
      form.append("MetaData[Owner]", uploadData.metadata.owner);
      form.append("MetaData[OwnerType]", uploadData.metadata.ownerType);

      if (uploadData.metadata.commit) {
        form.append("MetaData[Commit]", uploadData.metadata.commit);
        form.append("MetaData[CommitShort]", uploadData.metadata.commitShort);
        form.append("MetaData[Author]", uploadData.metadata.author);
        form.append("MetaData[Date]", uploadData.metadata.date);
        form.append("MetaData[Committer]", uploadData.metadata.committer);
        form.append("MetaData[Message]", uploadData.metadata.message);
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "User-Agent": "iCredible-Git-Security/2.0",
        ...form.getHeaders(),
      };

      const response = await this.axiosInstance.post("/backup/shield", form, {
        headers: headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );

            if (percentCompleted - lastLoggedPercent >= 10) {
              this.logger.info(`Upload progress: ${percentCompleted}%`);
              lastLoggedPercent = percentCompleted;
            }

            if (percentCompleted === 100) {
              this.logger.info(
                "Upload completed, waiting for server response..."
              );
            }
          }
        },
      });

      const apiResponse: ApiResponse<BackupUploadResponse> = response.data;

      if (!apiResponse.success) {
        throw new Error(
          `Upload failed: ${apiResponse.error || apiResponse.message}`
        );
      }

      this.logger.info("Backup uploaded successfully");
      return apiResponse.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const serverError = JSON.stringify(error.response.data);
        this.handleError(
          new Error(
            `Upload failed: HTTP ${error.response.status} - ${serverError}`
          ),
          "Failed to upload backup"
        );
      } else {
        this.handleError(error, "Failed to upload backup");
      }
    }
  }

  public async requestOtp(
    deliveryMethod: "MAIL" | "AUTHENTICATOR",
    token: string
  ): Promise<OtpResponse> {
    this.ensureInitialized();
    try {
      this.logger.info(`Requesting OTP via ${deliveryMethod}`);

      const requestBody = {
        Type: deliveryMethod,
        Source: "FileDownload",
        OtpGenerationMode: "Number",
      };

      const response = await this.axiosInstance.post("/OTP/Send", requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const apiResponse: ApiResponse<OtpResponse> = response.data;
      if (!apiResponse.success) {
        throw new Error(
          `OTP request failed: ${apiResponse.error || apiResponse.message}`
        );
      }

      this.logger.info("OTP requested successfully");
      return apiResponse.data;
    } catch (error) {
      this.handleAxiosError(error, "Failed to request OTP");
    }
  }

  public async verifyOtp(
    uniqueKey: string,
    token: string
  ): Promise<OtpStatusResponse> {
    this.ensureInitialized();
    try {
      const requestBody = { uniqueKey: uniqueKey };

      const response = await this.axiosInstance.post(
        "/OTP/GetOTPStatus",
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const apiResponse: ApiResponse<boolean> = response.data;
      return { verified: apiResponse.success && apiResponse.data === true };
    } catch (error) {
      this.logger.warn(`OTP verification check failed: ${String(error)}`);
      return { verified: false };
    }
  }

  public async downloadBackup(
    fileVersionId: string,
    token: string,
    uniqueKey: string
  ): Promise<Buffer> {
    this.ensureInitialized();
    try {
      this.logger.info(`Downloading backup with version ID: ${fileVersionId}`);

      const response = await this.axiosInstance.get(
        `/restore/${fileVersionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Unique-Key": uniqueKey,
            "X-Verification-Key": "1",
          },
          responseType: "arraybuffer",
        }
      );

      const buffer = Buffer.from(response.data);
      this.logger.info(
        `Backup downloaded successfully. Size: ${buffer.length} bytes`
      );
      return buffer;
    } catch (error) {
      this.handleAxiosError(error, "Failed to download backup");
    }
  }

  private handleAxiosError(error: any, contextMessage: string): never {
    if (axios.isAxiosError(error) && error.response) {
      const serverError = JSON.stringify(error.response.data);
      this.handleError(
        new Error(
          `${contextMessage}: HTTP ${error.response.status} - ${serverError}`
        ),
        contextMessage
      );
    } else {
      this.handleError(error, contextMessage);
    }
  }
}
