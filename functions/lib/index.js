"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToUtf8 = void 0;
const firebase_functions_1 = require("firebase-functions");
(0, firebase_functions_1.setGlobalOptions)({ maxInstances: 10 });
var covert_to_utf8_1 = require("./functions/covert-to-utf8");
Object.defineProperty(exports, "convertToUtf8", { enumerable: true, get: function () { return covert_to_utf8_1.convertToUtf8; } });
//# sourceMappingURL=index.js.map