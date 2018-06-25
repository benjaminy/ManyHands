import assert from "assert";
import * as my_crypto from "../clean/crypto_wrappers";
import * as double_ratchet from "../clean/double_ratchet"
import * as my_user from "../clean/user"

import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

async function main() {
    await test_send_with_public_key();
    await test_multiple_sends();
}
main();


async function test_send_with_public_key() {
    named_log("testing sending a message with new keypair");
    // need a shared secret
    let shared_secret = await my_crypto.random_secret();
    let initial_message = "I'm running away to the circus mom!";

    // need two users
    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    let bobs_keypair = await my_crypto.generate_dh_key();

    await my_user.init_sender(alice, shared_secret, bobs_keypair.publicKey);
    await my_user.init_reciever(bob, shared_secret, bobs_keypair);

    let send_buffer = await double_ratchet.ratchet_encrypt(
        alice, initial_message
    );
    let decrypted_message = await double_ratchet.ratchet_decrypt(
        bob, send_buffer
    );


    assert(initial_message === decrypted_message);
    success();
}

async function test_multiple_sends() {
    named_log("testing sending more than one message");
    // need a shared secret
    let shared_secret = await my_crypto.random_secret();
    let message_one = "I'm running away to the circus mom!";
    let message_two = "I'm never coming home again mum!";

    // need two users
    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    let bobs_keypair = await my_crypto.generate_dh_key();

    await my_user.init_sender(alice, shared_secret, bobs_keypair.publicKey);
    await my_user.init_reciever(bob, shared_secret, bobs_keypair);

    let send_buffer_one = await double_ratchet.ratchet_encrypt(
        alice, message_one
    );
    let send_buffer_two = await double_ratchet.ratchet_encrypt(
        alice, message_two
    );
    let decrypted_message_one = await double_ratchet.ratchet_decrypt(
        bob, send_buffer_one
    );
    let decrypted_message_two = await double_ratchet.ratchet_decrypt(
        bob, send_buffer_two
    );

    assert(message_one === decrypted_message_one);
    assert(message_two === decrypted_message_two);
    success();
}


function named_log(name) {
    let cyan = '\x1b[36m%s\x1b[0m';
    console.log(cyan, "*******************************");
    console.log(cyan, name);
    console.log(cyan, "*******************************");
}

function success() {
    let green = "\x1b[32m%s\x1b[0m";
    console.log(green, "success!");
    console.log();
}
