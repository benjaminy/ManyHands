import * as dr from "./double_ratchet"
import * as crypto from "./crypto_wrappers"
import * as user from "./user"
import * as user_messaging from "./user_messaging"
import * as diffie from "./triple_dh"
import SM from "../../../Storage/in_memory";
import * as SW from "../../../Storage/wrappers";

import assert from "assert";

const groups = {};

export async function compare(ts1, ts2) {
    var equality = 0;
    for (var user in ts1) {
        if (ts1[user] === ts2[user]) {
        }
        else if (ts1[user] > ts2[user]) {
            if (equality === -1) {
                equality = 0;
                break;
            }
            equality = 1;
        }
        else if (ts1[user] < ts2[user]) {
            if (equality === 1) {
                equality = 0;
                break;
            }
            equality = -1;
        }
    }

    return equality;

}
