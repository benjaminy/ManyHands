import {user} from "./user";
import {generate_dh_keypair} from "./crypto_helpers";

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;

// want to start with sending json over the wire.
let internet = "";

async function main() {
    let alice = user("alice");
    let bob = user("bob");
    let fox_message = "the lazy brown fox jumps over the log";


    let new_key = await generate_dh_keypair();

    await send(fox_message, new_key.publicKey);
    recieve(internet);

}

async function send(message, public_key) {
    let message_object = {};

    let key_object = await CS.exportKey("jwk", public_key);

    message_object.public_key = key_object;
    message_object.message = message;

    internet = JSON.stringify(message_object);
}

async function recieve(cipher_message) {
    // will need to decrypt in the future.
    let message_object = JSON.parse(cipher_message);

    if ('public_key' in message_object) {
        let import_key = CS.importKey(
            "jwk", message_object.public_key,
            { name: "ECDH", namedCurve: "P-256" },
            false, ["deriveKey", "deriveBits"]
        );
        console.log("THERE IS A KEY!!!");
    }
    return message_object.message;


}


main();
