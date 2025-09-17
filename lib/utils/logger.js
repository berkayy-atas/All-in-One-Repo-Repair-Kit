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
exports.ConsoleLogger = exports.GitHubActionsLogger = void 0;
const core = __importStar(require("@actions/core"));
class GitHubActionsLogger {
    info(message) {
        core.info(message);
    }
    warn(message) {
        core.warning(message);
    }
    error(message, error) {
        core.error(message);
        if (error) {
            core.debug(`Error stack: ${error.stack || 'No stack trace available'}`);
        }
    }
    notice(message) {
        core.notice(message);
    }
    debug(message) {
        core.debug(message);
    }
    setSecret(secret) {
        core.setSecret(secret);
    }
}
exports.GitHubActionsLogger = GitHubActionsLogger;
class ConsoleLogger {
    info(message) {
        console.log(`[INFO] ${message}`);
    }
    warn(message) {
        console.warn(`[WARN] ${message}`);
    }
    error(message, error) {
        console.error(`[ERROR] ${message}`);
        if (error) {
            console.error(`[ERROR] Stack: ${error.stack || 'No stack trace available'}`);
        }
    }
    notice(message) {
        console.log(`[NOTICE] ${message}`);
    }
    debug(message) {
        console.log(`[DEBUG] ${message}`);
    }
    setSecret(secret) {
        this.debug(`Secret set (length: ${secret.length})`);
    }
}
exports.ConsoleLogger = ConsoleLogger;
//# sourceMappingURL=logger.js.map