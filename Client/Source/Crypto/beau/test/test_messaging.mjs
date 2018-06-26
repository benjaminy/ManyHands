import assert from "assert";
import * as my_crypto from "../clean/crypto_wrappers";
import * as double_ratchet from "../clean/double_ratchet"
import * as my_user from "../clean/user"
import * as messaging from "../clean/messaging"

import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

async function main() {
    await test_adding_two_particpants();
    // await test_adding_multiple_particpants();
    await test_simple_messaging();
    await test_simple_two_way_messaging();
    await test_simple_two_way_messaging();
}
main();

async function test_adding_two_particpants() {
    named_log("testing initializing multiple chat participants");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    await messaging.start_conversation([alice, bob]);

    assert(Array.isArray(alice.messaging.bob));
    assert(Array.isArray(bob.messaging.alice));

    success();
}

/*
TODO: probably will exist in group messaging
async function test_adding_multiple_particpants() {
    named_log("testing initializing multiple chat participants");

    let alice = await my_user.user("alice");
    let carol = await my_user.user("carol");
    let bob = await my_user.user("bob");

    await messaging.start_conversation([alice, carol, bob]);

    assert(Array.isArray(alice.messaging.carol));
    assert(Array.isArray(alice.messaging.bob));
    assert(Array.isArray(carol.messaging.alice));
    assert(Array.isArray(carol.messaging.bob));
    assert(Array.isArray(bob.messaging.alice));
    assert(Array.isArray(bob.messaging.carol));
    success();
}
*/

async function test_simple_messaging() {
    named_log("test alice and bob sending each other a few messages");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    await messaging.start_conversation([alice, bob]);

    let message_0 = "Mom Im running away to the circus!";
    let message_1 = "And Im never coming home again!";
    let message_2 = "Johnny will be sad, but when hes older he will understand!";

    await messaging.send(alice, bob, message_0);
    await messaging.send(alice, bob, message_1);
    await messaging.send(alice, bob, message_2);

    let bobs_messages = await messaging.recieve_all(bob, alice);
    assert(bobs_messages[0] === message_0);
    assert(bobs_messages[1] === message_1);
    assert(bobs_messages[2] === message_2);
    success();
}

// It seems fair to assume that you never send a message until you've
// recieved at least one.
async function test_simple_two_way_messaging() {
    named_log("test alice and bob sending each other a few messages");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    await messaging.start_conversation([alice, bob]);

    let message_0 = "Mom Im running away to the circus!";
    let message_1 = "And Im never coming home again!";
    let message_2 = "Johnny will be sad, but when hes older he will understand!";

    let message_3 = "you can't run away!";
    let message_4 = "who will milk the cows in the morning???";
    let message_5 = "And also! You are only 9 years old!";

    await messaging.send(alice, bob, message_0);
    await messaging.send(alice, bob, message_1);
    await messaging.send(alice, bob, message_2);

    let bobs_messages = await messaging.recieve_all(bob, alice);

    await messaging.send(bob, alice, message_3);
    await messaging.send(bob, alice, message_4);
    await messaging.send(bob, alice, message_5);

    let alices_messages = await messaging.recieve_all(alice, bob);

    assert(bobs_messages[0] === message_0);
    assert(bobs_messages[1] === message_1);
    assert(bobs_messages[2] === message_2);

    assert(alices_messages[0] === message_3);
    assert(alices_messages[1] === message_4);
    assert(alices_messages[2] === message_5);

    success();
}


async function test_non_trivial_two_way_messaging() {
    named_log("test alice and bob sending each other a few messages");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    await messaging.start_conversation([alice, bob]);

    let message_0 = "Mom Im running away to the circus!";
    let message_1 = "And Im never coming home again!";
    let message_2 = "Johnny will be sad, but when hes older he will understand!";

    let message_3 = "you can't run away!";
    let message_4 = "who will milk the cows in the morning???";
    let message_5 = "And also! You are only 9 years old!";

    await messaging.send(alice, bob, message_0);

    let bobs_messages_0 = await messaging.recieve_all(bob, alice);

    await messaging.send(bob, alice, message_1);
    await messaging.send(alice, bob, message_2);


    let alices_messages_0 = await messaging.recieve_all(alice, bob);
    let bobs_messages_1 = await messaging.recieve_all(bob, alice);

    assert(bobs_messages_0[0] === message_0);

    assert(alices_messages_0[0] === message_1);
    assert(bobs_messages_1[0] === message_2);
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
