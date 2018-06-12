import {user} from "./user";

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;

let internet = "";
let iv_value = new Uint32Array([272313578, 3325780468, 283646714, 120955213]).buffer;

async function main() {
    let shared_secret = await WC.getRandomValues(new Uint32Array(8));


    let alice = await user("alice");
    let bob = await user("bob");

    alice.secret_key = shared_secret;
    bob.secret_key = shared_secret;

    await send(alice, "the lazy brown fox jumps over the log");
    console.log(await recieve(bob));

}

main();


async function encrypt(message, secret_buffer) {
    let message_buffer = Encoder.encode(message);

    let cbc_key = await CS.importKey(
        "raw", secret_buffer, { name: "AES-CBC"}, false, ["encrypt", "decrypt"]
    );

    let encryption = await CS.encrypt(
        { name: "AES-CBC", iv: iv_value }, cbc_key, message_buffer
    );

    return encryption;
}

async function decrypt(message_buffer, secret_buffer) {

    let cbc_key = await CS.importKey(
        "raw", secret_buffer, { name: "AES-CBC"}, false, ["encrypt", "decrypt"]
    );

    let decryption = await CS.decrypt(
        {name: "AES-CBC", iv: iv_value }, cbc_key, message_buffer
    );

    let message = Decoder.decode(decryption);

    return message;

}

async function send(user, message) {
    let encryption = await encrypt(message, user.secret_key.buffer);
    internet = encryption;
}

async function recieve(user) {
    let message = await decrypt(internet, user.secret_key.buffer);
    return message;
}