import { setGlobalOptions } from "firebase-functions";

setGlobalOptions({ maxInstances: 10 });

export { convertToUtf8 } from "./functions/covert-to-utf8";