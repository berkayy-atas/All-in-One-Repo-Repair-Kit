#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const core = __importStar(require("@actions/core"));
const service_container_1 = require("./services/container/service-container");
async function run() {
    const container = new service_container_1.ServiceContainer();
    const logger = container.getLogger();
    logger.info(`${process.env.GITHUB_TOKEN}`);
    try {
        logger.info('🛡️ iCredible Git Security v2.0 - Starting...');
        await container.initializeServices();
        await container.validateConfiguration();
        container.maskSecrets();
        const configService = container.getConfigService();
        const config = configService.getConfig();
        logger.info(`Action type: ${config.inputs.action}`);
        logger.info(`Repository: ${process.env.GITHUB_REPOSITORY}`);
        if (config.inputs.action === 'backup') {
            logger.info('Executing backup workflow...');
            const backupWorkflow = container.getBackupWorkflowService();
            await backupWorkflow.initialize();
            const result = await backupWorkflow.execute();
            if (!result.success) {
                core.setFailed(result.message);
                return;
            }
            core.setOutput('record_id', result.recordId || '');
            core.setOutput('directory_record_id', result.directoryRecordId || '');
            core.setOutput('file_size', result.fileSize?.toString() || '0');
            core.setOutput('compressed_size', result.compressedSize?.toString() || '0');
            core.setOutput('encrypted_size', result.encryptedSize?.toString() || '0');
        }
        else if (config.inputs.action === 'restore') {
            logger.info('Executing restore workflow...');
            if (!config.inputs.file_version_id) {
                throw new Error('file_version_id is required for restore operation');
            }
            const restoreWorkflow = container.getRestoreWorkflowService(config.inputs.icredible_repository_restore_token);
            await restoreWorkflow.initialize();
            const result = await restoreWorkflow.execute(config.inputs.file_version_id);
            if (!result.success) {
                core.setFailed(result.message);
                return;
            }
            core.setOutput('file_version_id', result.fileVersionId || '');
            core.setOutput('workflows_suspended', result.workflowsSuspended?.toString() || 'false');
        }
        else {
            throw new Error(`Invalid action type: ${config.inputs.action}`);
        }
        logger.info('✅ Operation completed successfully');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Operation failed: ${errorMessage}`, error instanceof Error ? error : undefined);
        core.setFailed(errorMessage);
    }
    finally {
        container.dispose();
    }
}
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
if (require.main === module) {
    run().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map