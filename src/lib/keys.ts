import { randomBytes } from "node:crypto";

/** Public site key for the tracking script, e.g. "fw_Xk3…". Not secret. */
export const newPublicKey = () => "fw_" + randomBytes(9).toString("base64url");

/** Secret for server-to-server events, e.g. "fws_9f2…". Keep it private. */
export const newIngestSecret = () => "fws_" + randomBytes(24).toString("hex");
