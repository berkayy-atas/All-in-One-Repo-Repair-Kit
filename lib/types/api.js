"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionType = exports.CompressionLevel = exports.CompressionEngine = void 0;
var CompressionEngine;
(function (CompressionEngine) {
    CompressionEngine[CompressionEngine["None"] = 0] = "None";
    CompressionEngine[CompressionEngine["Zip"] = 1] = "Zip";
    CompressionEngine[CompressionEngine["GZip"] = 2] = "GZip";
    CompressionEngine[CompressionEngine["Brotli"] = 3] = "Brotli";
})(CompressionEngine || (exports.CompressionEngine = CompressionEngine = {}));
var CompressionLevel;
(function (CompressionLevel) {
    CompressionLevel[CompressionLevel["Optimal"] = 0] = "Optimal";
    CompressionLevel[CompressionLevel["Fastest"] = 1] = "Fastest";
    CompressionLevel[CompressionLevel["NoCompression"] = 2] = "NoCompression";
    CompressionLevel[CompressionLevel["SmallestSize"] = 3] = "SmallestSize";
})(CompressionLevel || (exports.CompressionLevel = CompressionLevel = {}));
var EncryptionType;
(function (EncryptionType) {
    EncryptionType[EncryptionType["None"] = 0] = "None";
    EncryptionType[EncryptionType["ChaCha20Poly1305"] = 1] = "ChaCha20Poly1305";
    EncryptionType[EncryptionType["Aes"] = 2] = "Aes";
})(EncryptionType || (exports.EncryptionType = EncryptionType = {}));
//# sourceMappingURL=api.js.map