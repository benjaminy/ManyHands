import {encrypt_sign, decrypt_verify, increment} from "./crypto_helpers";
import {user} from "./user";

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;

let internet = "";

async function main() {
    let shared_secret = await WC.getRandomValues(new Uint32Array(8));
    let alice = await user("alice", shared_secret);
    let bob = await user("bob", shared_secret);

    await send("the lazy brown fox jumps over the log", alice);
    // console.log(internet);
    await recieve(bob, false);


}

main();

async function send(message, user) {
    let encrypted_message = await encrypt_sign({message: message}, user.send);
    user.send = await increment(user.send);
    internet = encrypted_message;
}

async function recieve(user, first_message) {
    let message = internet;
    let message_object = await decrypt_verify(message, user.recieve);


     if (!message_object.verification) {
         user.root = await increment(user.root);
         user.recieve = await increment(user.root);
         message_object = await decrypt_verify(message, user.recieve);
     }

     if (first_message) {
         if (Math.random < 0.5) {
             user.root = increment(user.root);
             user.send = increment(user.root);
         }
     }
     console.log(message_object.decryption.message);
}
