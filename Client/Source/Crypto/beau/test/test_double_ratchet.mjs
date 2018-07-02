import assert from "assert";
import * as crypto from "../clean/crypto_wrappers";
import * as dr from "../clean/double_ratchet"
import * as user from "../clean/user"

import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

async function main() {
    // await test_send_with_public_key();
    // await test_multiple_sends();
    await test_parse_form_message();
    await test_parse_form_message_with_empty_header();
}
main();


async function test_parse_form_message() {
    named_log("testing forming and parsing a message buffer");

    const header = {};
    header.name = "Beau";
    header.occupation = "student";
    header.age = 20;

    const text = "the lazy brown fox jumps over the log";
    const text_buffer = crypto.encode_string(text);

    const message_buffer = await dr.form_message_buffer(header, text_buffer);

    const parsed_message = await dr.parse_message_buffer(message_buffer);

    assert(parsed_message.header.name === header.name);
    assert(parsed_message.header.occupation === header.occupation);
    assert(parsed_message.header.age === header.age);

    assert(parsed_message.message === text);

    success();

}

async function test_parse_form_message_with_empty_header() {
    named_log("testing creating a message buffer with an empty header object");

    const header = {};

    const text = "the lazy brown fox jumps over the log";
    const text_buffer = crypto.encode_string(text);

    const message_buffer = await dr.form_message_buffer(header, text_buffer);

    const parsed_message = await dr.parse_message_buffer(message_buffer);

    assert(Object.keys(parsed_message.header).length === 0);

    assert(parsed_message.message === text);

    success();
}



//
// async function test_send_with_public_key() {
//     named_log("testing sending a message with new keypair");
//     // need a shared secret
//     let shared_secret = await my_crypto.random_secret();
//     let initial_message = "I'm running away to the circus mom!";
//
//     // need two users
//     let alice = await my_user.user("alice");
//     let bob = await my_user.user("bob");
//
//     let bobs_keypair = await my_crypto.generate_dh_key();
//
//     await my_user.init_conversation(alice, bob, shared_secret, bobs_keypair);
//
//     let send_buffer = await double_ratchet.ratchet_encrypt(
//         alice.conversations.bob, initial_message
//     );
//     let decrypted_message = await double_ratchet.ratchet_decrypt(
//         bob.conversations.alice, send_buffer
//     );
//
//     assert(initial_message === decrypted_message);
//     success();
// }
//
// async function test_multiple_sends() {
//     named_log("testing sending more than one message");
//     // need a shared secret
//     let shared_secret = await my_crypto.random_secret();
//     let message_one = "I'm running away to the circus mom!";
//     let message_two = "I'm never coming home again mum!";
//
//     // need two users
//     let alice = await my_user.user("alice");
//     let bob = await my_user.user("bob");
//
//     let bobs_keypair = await my_crypto.generate_dh_key();
//
//     await my_user.init_conversation(alice, bob, shared_secret, bobs_keypair);
//
//     let send_buffer_one = await double_ratchet.ratchet_encrypt(
//         alice.conversations.bob, message_one
//     );
//     let send_buffer_two = await double_ratchet.ratchet_encrypt(
//         alice.conversations.bob, message_two
//     );
//     let decrypted_message_one = await double_ratchet.ratchet_decrypt(
//         bob.conversations.alice, send_buffer_one
//     );
//     let decrypted_message_two = await double_ratchet.ratchet_decrypt(
//         bob.conversations.alice, send_buffer_two
//     );
//
//     assert(message_one === decrypted_message_one);
//     assert(message_two === decrypted_message_two);
//     success();
// }


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
