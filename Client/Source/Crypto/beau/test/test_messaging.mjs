import assert from "assert";
import * as user from "../clean/user"
import * as messaging from "../clean/messaging"
import * as crypto from "../clean/crypto_wrappers"

import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

import TextEncoder from "text-encoding";
const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

async function main() {
    await test_single_message_send_recieve();
    await test_back_and_forth_send_and_recieve();
    await test_asyncronous_sending();
    await test_sending_and_recieving_from_multiple_people();
}
main();

async function test_single_message_send_recieve() {
    named_log("testing sending a single message from alice to bob");
    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    let a2b = [];
    let b2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    messages = ["The lazy brown fox jumps over the lazy logs"];

    await messaging.send(alice, bob.pub, messages[0]);
    a2b.push(messages[0]);

    const message_0 = await messaging.recieve_message(bob);

    assert(message_0 === a2b.shift());

    success();
}


async function test_back_and_forth_send_and_recieve() {
    named_log("testing non-asyncrynous messaging between alice and bob");

    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    let a2b = [];
    let b2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    await messaging.send(alice, bob.pub, messages[0]);
    await messaging.send(alice, bob.pub, messages[1])
    a2b.push(messages[0]);
    a2b.push(messages[1]);

    const message_0 = await messaging.recieve_message(bob);
    const message_1 = await messaging.recieve_message(bob);
    assert(message_0 === a2b.shift());
    assert(message_1 === a2b.shift());



    await messaging.send(bob, alice.pub, messages[2]);
    await messaging.send(bob, alice.pub, messages[3]);
    b2a.push(messages[2]);
    b2a.push(messages[3]);

    const message_2 = await messaging.recieve_message(alice);
    const message_3 = await messaging.recieve_message(alice);
    assert(message_2 === b2a.shift());
    assert(message_3 === b2a.shift());

    await messaging.send(alice, bob.pub, messages[4]);
    await messaging.send(alice, bob.pub, messages[5])
    a2b.push(messages[4]);
    a2b.push(messages[5]);

    const message_4 = await messaging.recieve_message(bob);
    const message_5 = await messaging.recieve_message(bob);
    assert(message_4 === a2b.shift());
    assert(message_5 === a2b.shift());



    await messaging.send(bob, alice.pub, messages[6]);
    await messaging.send(bob, alice.pub, messages[7]);
    b2a.push(messages[6]);
    b2a.push(messages[7]);

    const message_6 = await messaging.recieve_message(alice);
    const message_7 = await messaging.recieve_message(alice);
    assert(message_6 === b2a.shift());
    assert(message_7 === b2a.shift());

    success();
}

async function test_asyncronous_sending() {
    named_log("test out of order sends and recieves");

    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    let a2b = [];
    let b2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    await messaging.send(alice, bob.pub, messages[0]);
    await messaging.send(alice, bob.pub, messages[1])
    a2b.push(messages[0]);
    a2b.push(messages[1]);

    const message_0 = await messaging.recieve_message(bob);
    const message_1 = await messaging.recieve_message(bob);
    assert(message_0 === a2b.shift());
    assert(message_1 === a2b.shift());



    await messaging.send(bob, alice.pub, messages[2]);
    await messaging.send(bob, alice.pub, messages[3]);
    b2a.push(messages[2]);
    b2a.push(messages[3]);


    await messaging.send(alice, bob.pub, messages[4]);
    await messaging.send(alice, bob.pub, messages[5])
    a2b.push(messages[4]);
    a2b.push(messages[5]);

    const message_2 = await messaging.recieve_message(alice);
    const message_3 = await messaging.recieve_message(alice);
    assert(message_2 === b2a.shift());
    assert(message_3 === b2a.shift());

    const message_4 = await messaging.recieve_message(bob);
    const message_5 = await messaging.recieve_message(bob);
    assert(message_4 === a2b.shift());
    assert(message_5 === a2b.shift());



    await messaging.send(bob, alice.pub, messages[6]);
    await messaging.send(bob, alice.pub, messages[7]);
    b2a.push(messages[6]);
    b2a.push(messages[7]);

    const message_6 = await messaging.recieve_message(alice);
    const message_7 = await messaging.recieve_message(alice);
    assert(message_6 === b2a.shift());
    assert(message_7 === b2a.shift());

    success();
}


async function test_single_recieve_asyncronous_sending() {
    named_log("test recieving a single message out of order");

    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    let a2b = [];
    let b2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    await messaging.send(alice, bob.pub, messages[0]);
    await messaging.send(alice, bob.pub, messages[1])
    a2b.push(messages[0]);
    a2b.push(messages[1]);

    const message_0 = await messaging.recieve_message(bob);
    const message_1 = await messaging.recieve_message(bob);
    assert(message_0 === a2b.shift());
    assert(message_1 === a2b.shift());



    await messaging.send(bob, alice.pub, messages[2]);
    await messaging.send(bob, alice.pub, messages[3]);
    b2a.push(messages[2]);
    b2a.push(messages[3]);
    const message_2 = await messaging.recieve_message(alice);
    assert(message_2 === b2a.shift());


    await messaging.send(alice, bob.pub, messages[4]);
    await messaging.send(alice, bob.pub, messages[5])
    a2b.push(messages[4]);
    a2b.push(messages[5]);
    const message_4 = await messaging.recieve_message(bob);
    assert(message_4 === a2b.shift());

    const message_3 = await messaging.recieve_message(alice);
    assert(message_3 === b2a.shift());

    const message_5 = await messaging.recieve_message(bob);
    assert(message_5 === a2b.shift());



    await messaging.send(bob, alice.pub, messages[6]);
    await messaging.send(bob, alice.pub, messages[7]);
    b2a.push(messages[6]);
    b2a.push(messages[7]);

    const message_6 = await messaging.recieve_message(alice);
    const message_7 = await messaging.recieve_message(alice);
    assert(message_6 === b2a.shift());
    assert(message_7 === b2a.shift());

    success();
}

async function test_sending_and_recieving_from_multiple_people() {
    named_log("test recieving a single message out of order");

    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");
    const carol = await user.new_user("carol");

    let a2b = [];
    let a2c = [];
    let b2a = [];
    let c2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    await messaging.send(alice, bob.pub, messages[0]);
    await messaging.send(alice, bob.pub, messages[1])
    a2b.push(messages[0]);
    a2b.push(messages[1]);

    await messaging.send(alice, carol.pub, messages[2]);
    await messaging.send(alice, carol.pub, messages[3])
    a2c.push(messages[2]);
    a2c.push(messages[3]);

    const message_0 = await messaging.recieve_message(bob);
    const message_1 = await messaging.recieve_message(bob);
    assert(message_0 === a2b.shift());
    assert(message_1 === a2b.shift());

    const message_2 = await messaging.recieve_message(carol);
    const message_3 = await messaging.recieve_message(carol);
    assert(message_2 === a2c.shift());
    assert(message_3 === a2c.shift());


    await messaging.send(bob, alice.pub, messages[4]);
    await messaging.send(bob, alice.pub, messages[5])
    b2a.push(messages[4]);
    b2a.push(messages[5]);

    await messaging.send(carol, alice.pub, messages[6]);
    await messaging.send(carol, alice.pub, messages[7])
    c2a.push(messages[6]);
    c2a.push(messages[7]);


    const message_4 = await messaging.recieve_message(alice);
    const message_5 = await messaging.recieve_message(alice);
    assert(message_4 === b2a.shift());
    assert(message_5 === b2a.shift());

    const message_6 = await messaging.recieve_message(alice);
    const message_7 = await messaging.recieve_message(alice);
    assert(message_6 === c2a.shift());
    assert(message_7 === c2a.shift());

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
