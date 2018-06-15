import {encrypt_sign, decrypt_verify, step} from "./crypto_helpers";
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

    await send("the lazy brown fox jumps over the log", alice, bob);
    await recieve_all_messages(alice, bob);


}

main();

async function send(message, user_from, user_to) {
    let encrypted_message = await encrypt_sign({message: message}, user_from.send);
    user.send = await step(user_from.send);
    interweb.send(user_from, user_to, encrypted_message);
}

async function recieve_all_messages(user_from, user_to) {
    let messages = interweb.recieve_all(user_from, user_to);
    for (let i = 0; i < messages.length; i++) {
        let message = await recieve(messages[i], user_to);
    }
}

async function recieve(message, user_to) {
    let message_object = await decrypt_verify(message, user_to.recieve);

     if (!message_object.verification) {
         user_to.root = await step(user_to.root);
         user_to.recieve = await step(user_to.root);
         message_object = await decrypt_verify(message, user_to.recieve);
     }

     // if (first_message) {
     //     if (Math.random < 0.5) {
     //         user_to.root = step(user_to.root);
     //         user_to.send = step(user_to.root);
     //     }
     // }
     console.log(message_object.decryption.message);
}
