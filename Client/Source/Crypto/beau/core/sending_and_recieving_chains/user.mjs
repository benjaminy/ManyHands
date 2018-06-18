import {step} from "./crypto_helpers"
import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const iv_32 = new Uint32Array([272313578, 3325780468, 283646714, 120955213]);
const iv_val = new Uint8Array(iv_32.buffer);

const WC = new WebCrypto();
const CS = WC.subtle;


export async function user(name, secret) {
    let u = {};
    u.name = name;
    u.root = await step(secret);
    u.send = await step(u.root);
    u.send = await step(u.send);
    u.recieve = await step(u.root);
    u.recieve = await step(u.recieve);
    return u;
}

async function main() {
    let shared_secret = await WC.getRandomValues(new Uint32Array(8));

    let alice = await user("alice", shared_secret);
    let bob = await user("bob", shared_secret);
}
