import {encrypt_sign, decrypt_verify, step, step_root, step_recieve, step_send} from "./crypto_helpers";
import {user} from "./user";
import {internet} from "./internet";

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;

const garbage_seed = new Uint32Array([274113578, 3345781468, 243641714, 120945113]);
const garbage_val = garbage_seed.buffer;

let interweb = internet();

async function main() {

    let shared_secret = await WC.getRandomValues(new Uint32Array(8));
    let alice = await user("alice", shared_secret);
    let bob = await user("bob", shared_secret);

    interweb.add_user(alice);
    interweb.add_user(bob);

    await send("first message", alice, bob);
    await send("second message", alice, bob);
    await send("third message", alice, bob);
    await send("fourth message", alice, bob);
    await send("fifth message", alice, bob);
    await send("sixth message", alice, bob);
    await recieve_all_messages(alice, bob);

}

main();

async function send(message, user_from, user_to) {
    let message_object = {};

    if (user_from.send_key) {
        let new_key = await CS.generateKey(
            { name: "ECDH", namedCurve: "P-256"},
            true, ["deriveKey", "deriveBits"]
        );

        let key_to_send = await CS.exportKey(
            "jwk", new_key.publicKey
        );

        message_object.public_key = key_to_send;

        user_from.sent_key = new_key.privateKey;

        if (user_from.recieved_key) {
            let recieve_seed = await CS.deriveBits(
                { name: "ECDH", namedCurve: "P-256", public: user_from.recieved_key},
                user_from.sent_key, 256
            );
            user_to.root = await step_root(user_to.root, recieve_seed);
            user_to.recieve = await step_recieve(user_to.root);
        }

        user_from.send_key = false;
    }

    user_from.send = await step_send(user_from.send);
    message_object.message = message;

    let encrypted_message = await encrypt_sign(message_object, user_from.send);

    interweb.send(user_from, user_to, encrypted_message);
}

async function recieve_all_messages(user_from, user_to) {
    let messages = interweb.recieve_all(user_from, user_to);
    for (let i = 0; i < messages.length; i++) {
        let message = await recieve(messages[i], user_to);
    }
}

async function recieve(message, user_to) {
    user_to.recieve = await step_recieve(user_to.recieve);
    let message_object = await decrypt_verify(message, user_to.recieve);

    if (!message_object.verification) {
        let new_root = await step_root(user_to.root);
        user_to.root = new_root;
        user_to.recieve = await step_recieve(new_root);
        message_object = await decrypt_verify(message, user_to.recieve);
    }

    if (message_object.public_key) {

        let new_public_key = await CS.importKey(
            "jwk", message_object.public_key,
            {name: "ECDH", namedCurve: "P-256"},
            false, ["deriveKey", "deriveBits"]
        );

        user_to.recieved_key = new_public_key;

        if (user_to.sent_key) {
            let send_seed = await CS.deriveBits(
                { name: "ECDH", namedCurve: "P-256", public: user_to.recieved_key},
                user_to.sent_key, 256
            );

            user_to.root = await step_root(user_to.root, send_seed);
            user_to.send = await step_send(user_to.root);

            user_to.sent_key = true;
        }
        console.log("LOOK LOOK LOOK! ITS A PUBLIC KEY!")
    }
    console.log(message_object.message);
}
