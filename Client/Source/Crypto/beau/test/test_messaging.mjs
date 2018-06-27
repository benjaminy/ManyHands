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
    // await test_adding_two_particpants();
    // await test_adding_multiple_particpants();
    await test_simple_messaging();
    await test_simple_two_way_messaging();
    await test_non_trivial_two_way_messaging();
    await test_more_non_trivial_two_way_messaging()
}
main();
//
// async function test_adding_two_particpants() {
//     named_log("testing initializing multiple chat participants");
//
//     let alice = await my_user.user("alice");
//     let bob = await my_user.user("bob");
//
//     await messaging.start_two_way_conversation([alice, bob]);
//
//     assert(Array.isArray(alice.messaging.bob));
//     assert(Array.isArray(bob.messaging.alice));
//
//     success();
// }

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

    await messaging.start_two_way_conversation(alice, bob);

    let message_0 = "Mom Im running away to the circus!";
    let message_1 = "And Im never coming home again!";
    let message_2 = "Johnny will be sad, but when hes older he will understand!";

    await messaging.send(alice, bob.name, message_0);
    await messaging.send(alice, bob.name, message_1);
    await messaging.send(alice, bob.name, message_2);

    let bobs_messages = await messaging.recieve_all(bob, alice.name);
    assert(bobs_messages[0] === message_0);
    assert(bobs_messages[1] === message_1);
    assert(bobs_messages[2] === message_2);
    success();
}


async function test_simple_two_way_messaging() {
    named_log("test alice and bob sending abnd recieving each other a few messages");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    await messaging.start_two_way_conversation(alice, bob);

    let message_0 = "Mom Im running away to the circus!";
    let message_1 = "And Im never coming home again!";
    let message_2 = "Johnny will be sad, but when hes older he will understand!";

    let message_3 = "you can't run away!";
    let message_4 = "who will milk the cows in the morning???";
    let message_5 = "And also! You are only 9 years old!";

    await messaging.send(alice, bob.name, message_0);
    await messaging.send(alice, bob.name, message_1);

    let bobs_messages = await messaging.recieve_all(bob, alice.name);

    await messaging.send(bob, alice.name, message_2);
    await messaging.send(bob, alice.name, message_3);

    let alices_messages = await messaging.recieve_all(alice, bob.name);

    await messaging.send(alice, bob.name, message_4);

    let bobs_messages_1 = await messaging.recieve_all(bob, alice.name);


    assert(bobs_messages[0] === message_0);
    assert(bobs_messages[1] === message_1);

    assert(alices_messages[0] === message_2);
    assert(alices_messages[1] === message_3);

    assert(bobs_messages_1[0] === message_4);

    success();
}

async function test_non_trivial_two_way_messaging() {
    named_log("test slight asyncrony between alice and bob");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    await messaging.start_two_way_conversation(alice, bob);

    let message_0 = "Mom Im running away to the circus!";
    let message_1 = "And Im never coming home again!";
    let message_2 = "Johnny will be sad, but when hes older he will understand!";

    let message_3 = "you can't run away!";
    let message_4 = "who will milk the cows in the morning???";
    let message_5 = "And also! You are only 9 years old!";

    await messaging.send(alice, bob.name, message_0);

    let bobs_messages_0 = await messaging.recieve_all(bob, alice.name);

    await messaging.send(bob, alice.name, message_1);
    await messaging.send(alice, bob.name, message_2);

    let alices_messages_0 = await messaging.recieve_all(alice, bob.name);
    let bobs_messages_1 = await messaging.recieve_all(bob, alice.name);

    // assert(bobs_messages_0[0] === message_0);
    //
    // assert(alices_messages_0[0] === message_1);
    // assert(bobs_messages_1[0] === message_2);
    success();
}

async function test_more_non_trivial_two_way_messaging() {
    named_log("test a bit more asyncrony between alice and bob");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    await messaging.start_two_way_conversation(alice, bob);

    let message_0 = "foo";
    let message_1 = "bar";
    let message_2 = "baz";
    let message_3 = "boop";
    let message_4 = "bop";
    let message_5 = "zip";
    let message_6 = "zop";

    await messaging.send(alice, bob.name, message_0);

    let bobs_messages_0 = await messaging.recieve_all(bob, alice.name);

    await messaging.send(bob, alice.name, message_1);
    await messaging.send(alice, bob.name, message_2);
    await messaging.send(bob, alice.name, message_3);
    await messaging.send(alice, bob.name, message_4);


    let alices_messages_0 = await messaging.recieve_all(alice, bob.name);
    let bobs_messages_1 = await messaging.recieve_all(bob, alice.name);

    await messaging.send(alice, bob.name, message_5);
    await messaging.send(alice, bob.name, message_6);

    let bobs_messages_2 = await messaging.recieve_all(bob, alice.name);

    assert(bobs_messages_0[0] === message_0);

    assert(alices_messages_0[0] === message_1);
    assert(alices_messages_0[1] === message_3);

    assert(bobs_messages_1[0] === message_2);
    assert(bobs_messages_1[1] === message_4);

    assert(bobs_messages_2[0] === message_5);
    assert(bobs_messages_2[1] === message_6);
    success();
}

async function test_very_non_trivial_two_way_messaging() {
    named_log("test a bit more asyncrony between alice and bob");

    let alice = await my_user.user("alice");
    let bob = await my_user.user("bob");

    await messaging.start_two_way_conversation(alice, bob);

    let message_0 = "foo";
    let message_1 = "bar";
    let message_2 = "baz";
    let message_3 = "boop";
    let message_4 = "bop";
    let message_5 = "zip";
    let message_6 = "zop";

    let a2b = [];
    let b2a = [];


    await messaging.send(alice, bob.name, message_0);
    a2b.shift(message_0);

    let bobs_messages_0 = await messaging.recieve_all(bob, alice.name);
    assert(a2b.pop() === bobs_messages_0[0]);

    await messaging.send(bob, alice.name, message_1);
    b2a.shift(message_1);

    await messaging.send(alice, bob.name, message_2);
    a2b.shift(message_2);

    await messaging.send(bob, alice.name, message_3);
    b2a.shift(message_3);

    await messaging.send(alice, bob.name, message_4);
    a2b.shift(message_4);


    let alices_messages_0 = await messaging.recieve_all(alice, bob.name);
    assert(b2a.pop() === alices_messages_0[0]);
    assert(b2a.pop() === alices_messages_0[1]);

    let bobs_messages_1 = await messaging.recieve_all(bob, alice.name);
    assert(a2b.pop() === bobs_messages_1[0]);
    assert(a2b.pop() === bobs_messages_1[1]);

    await messaging.send(alice, bob.name, message_5);
    a2b.shift(message_5);
    await messaging.send(alice, bob.name, message_6);
    a2b.shift(message_6);

    let bobs_messages_2 = await messaging.recieve_all(bob, alice.name);
    assert(a2b.pop() === bobs_messages_2[0]);
    assert(a2b.pop() === bobs_messages_2[1]);

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
