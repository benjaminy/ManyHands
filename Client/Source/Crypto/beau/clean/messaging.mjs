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


export async function start_conversation(participants) {
    assert(Array.isArray(participants));

    // TODO: Begin hack city

    let shared_secret = await my_crypto.random_secret();

    let reciever_keypair = await my_crypto.generate_dh_key();

    await my_user.init_sender(participants[0], shared_secret, reciever_keypair.publicKey);
    await my_user.init_reciever(participants[1], shared_secret, reciever_keypair);

    // TODO: end hack city

    for (let i = 0; i < participants.length; i++) {
        let curr = participants[i]
        for (let j = 0; j < participants.length; j++) {
            if (curr.name !== participants[j].name){
                let new_name = participants[j].name;
                if (curr.messaging[new_name] === undefined) {
                    curr.messaging[new_name] = [];
                }
            }
        }
    }
}

export async function send(sender, recipient, message) {
    assert(typeof sender.name === "string");
    assert(typeof recipient.name === "string");
    assert(typeof message === "string");

    let encrypted_message = await double_ratchet.ratchet_encrypt(sender, message);

    recipient.messaging[sender.name].push(encrypted_message);

}

export async function recieve_all(recipient, sender) {
    assert(typeof recipient.name === "string");
    assert(typeof recipient.name === "string");
    let output = [];
    for (let i = 0; i < recipient.messaging[sender.name].length; i++) {
        let curr = recipient.messaging[sender.name][i];
        let plain_text = await double_ratchet.ratchet_decrypt(recipient, curr);
        output.push(plain_text);
    }
    recipient.messaging[sender.name] = [];
    return output;
}
