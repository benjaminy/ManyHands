import * as my_crypto from "../clean/crypto_wrappers";
import * as double_ratchet from "../clean/double_ratchet"
import * as my_user from "../clean/user"

import {internet} from "./internet"

import assert from "assert";
import WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;

// Start conversation. create two qeues that for each my_user
// Bob
    // send queue 1
    // recieve queue 2

// Alice
    // send queue 2
    // recieve queue 1

// --> migrates to eventually be a dictionary.

// export async function start_conversation(participants) {
//     assert(Array.isArray(participants));
//
//     let shared_secret = await my_crypto.random_secret();
//
//     let reciever_keypair = await my_crypto.generate_dh_key();
//
//     await my_user.init_conversation(participants[0], participants[1]);
//
//     for (let i = 0; i < participants.length; i++) {
//         let curr = participants[i]
//
//         for (let j = 0; j < participants.length; j++) {
//
//             if (curr.name !== participants[j].name) {
//                 let new_name = participants[j].name;
//
//                 if (curr.messaging[new_name] === undefined) {
//                     curr.messaging[new_name] = [];
//                 }
//             }
//         }
//     }
// }

export async function start_two_way_conversation(sender, reciever) {
    let shared_secret = await my_crypto.random_secret();

    let reciever_keypair = await my_crypto.generate_dh_key();

    await my_user.init_conversation(sender, reciever, shared_secret, reciever_keypair);

    let sender_send = [];
    let sender_recieve = [];

    sender.conversations[reciever.name].send_queue = sender_send;
    sender.conversations[reciever.name].recieve_queue = sender_recieve;

    reciever.conversations[sender.name].send_queue = sender_recieve;
    reciever.conversations[sender.name].recieve_queue = sender_send;
}

// TODO Have a start group party conversation which can call the two party conversation in loops.
// TODO Have a two party start conversation


export async function send(sender, recipient_name, message) {
    assert(typeof sender.name === "string");
    assert(typeof recipient_name === "string");
    assert(typeof message === "string");

    let encrypted_message = await double_ratchet.ratchet_encrypt(
        sender.conversations[recipient_name], message
    );

    sender.conversations[recipient_name].send_queue.push(encrypted_message);

}

// TODO: implement single recieve function as well as the recieve all function.
export async function recieve_all(recipient, sender_name) {
    assert(typeof recipient.name === "string");
    assert(typeof sender_name === "string");
    let output = [];

    while (recipient.conversations[sender_name].recieve_queue.length > 0) {
        let current_message = recipient.conversations[sender_name].recieve_queue.shift()
        let plain_text = await double_ratchet.ratchet_decrypt(recipient.conversations[sender_name], current_message);
        output.push(plain_text)
    }

    return output;
}
