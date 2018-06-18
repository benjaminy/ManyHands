import {encrypt_sign, decrypt_verify, step, step_root, step_recieve, step_send} from "./crypto_helpers";
import {user} from "./user";
import {internet} from "./internet";

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;

let interweb = internet();

async function main() {
    let shared_secret = await WC.getRandomValues(new Uint32Array(8));
    let alice = await user("alice", shared_secret);
    let bob = await user("bob", shared_secret);

    interweb.add_user(alice);
    interweb.add_user(bob);

    await send("first message", alice, bob, true);
    await send("second message", alice, bob, false);
    await send("third message", alice, bob, false);
    await send("fourth message", alice, bob, true);
    await send("fifth message", alice, bob, false);
    await send("sixth message", alice, bob, false);
    await recieve_all_messages(alice, bob);

}

main();

async function send(message, user_from, user_to, first_message) {
    if (first_message) {
        let new_root = await step_root(user_from.root);
        user_from.root = new_root;
        user_from.send = await step_send(new_root);
    }
    else {
        user_from.send = await step_send(user_from.send);
    }
    let encrypted_message = await encrypt_sign({message: message}, user_from.send);
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
    console.log(message_object.decryption.message);
}
