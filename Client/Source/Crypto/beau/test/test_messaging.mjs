import assert from "assert";
import * as user from "../clean/user"
import * as messaging from "../clean/messaging"
import * as crypto from "../clean/crypto_wrappers"

async function main() {
    // await test_asyncronous_sending();
    // await test_single_group_message_send_recieve();
    // await test_back_and_forth_two_party_group_send_and_recieve();
    // await test_small_group_messaging();
}
main();

async function test_single_send_and_recieve() {
    named_log("test out of order sends and recieves");

    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    let a2b = [];
    let b2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }

    await messaging.send_user_message(alice, bob.pub, messages[0]);
    await messaging.send_user_message(alice, bob.pub, messages[1]);
    a2b.push(messages[0]);
    a2b.push(messages[1]);

    const message_0 = await messaging.recieve_user_message(bob, alice.pub);
    const message_1 = await messaging.recieve_user_message(bob, alice.pub);
    assert(message_0 === a2b.shift());
    assert(message_1 === a2b.shift());

    success();
}




//
// async function test_asyncronous_sending() {
//     named_log("test out of order sends and recieves");
//
//     const bob = await user.new_user("bob");
//     const alice = await user.new_user("alice");
//
//     let a2b = [];
//     let b2a = [];
//
//     let messages = [];
//     for (let i = 0; i < 20; i++) {
//         messages.push(Math.random().toString());
//     }
//
//     await messaging.send_group_message(alice, bob.pub, messages[0]);
//     await messaging.send_group_message(alice, bob.pub, messages[1])
//     a2b.push(messages[0]);
//     a2b.push(messages[1]);
//
//     const message_0 = await messaging.recieve_message(bob, alice.pub);
//     const message_1 = await messaging.recieve_message(bob, alice.pub);
//     assert(message_0 === a2b.shift());
//     assert(message_1 === a2b.shift());
//
//     await messaging.send_group_message(bob, alice.pub, messages[2]);
//     await messaging.send_group_message(bob, alice.pub, messages[3]);
//     b2a.push(messages[2]);
//     b2a.push(messages[3]);
//
//
//     await messaging.send_group_message(alice, bob.pub, messages[4]);
//     await messaging.send_group_message(alice, bob.pub, messages[5])
//     a2b.push(messages[4]);
//     a2b.push(messages[5]);
//
//     const message_2 = await messaging.recieve_group_message(alice);
//     const message_3 = await messaging.recieve_group_message(alice);
//     assert(message_2 === b2a.shift());
//     assert(message_3 === b2a.shift());
//
//     const message_4 = await messaging.recieve_group_message(bob);
//     const message_5 = await messaging.recieve_group_message(bob);
//     assert(message_4 === a2b.shift());
//     assert(message_5 === a2b.shift());
//
//     await messaging.send_group_message(bob, "foobar_group", messages[6]);
//     await messaging.send_group_message(bob, "foobar_group", messages[7]);
//     b2a.push(messages[6]);
//     b2a.push(messages[7]);
//
//     const message_6 = await messaging.recieve_group_message(alice);
//     const message_7 = await messaging.recieve_group_message(alice);
//     assert(message_6 === b2a.shift());
//     assert(message_7 === b2a.shift());
//
//     success();
// }
//
//
// async function test_single_recieve_asyncronous_sending() {
//     named_log("test recieving a single message out of order");
//
//     const bob = await user.new_user("bob");
//     const alice = await user.new_user("alice");
//
//     messaging.create_new_group("foobar_group", [alice, bob])
//
//     let a2b = [];
//     let b2a = [];
//
//     let messages = [];
//     for (let i = 0; i < 20; i++) {
//         messages.push(Math.random().toString());
//     }
//
//     await messaging.send_group_message(alice, "foobar_group", messages[0]);
//     await messaging.send_group_message(alice, "foobar_group", messages[1])
//     a2b.push(messages[0]);
//     a2b.push(messages[1]);
//
//     const message_0 = await messaging.recieve_group_message(bob);
//     const message_1 = await messaging.recieve_group_message(bob);
//     assert(message_0 === a2b.shift());
//     assert(message_1 === a2b.shift());
//
//     await messaging.send_group_message(bob, "foobar_group", messages[2]);
//     await messaging.send_group_message(bob, "foobar_group", messages[3]);
//     b2a.push(messages[2]);
//     b2a.push(messages[3]);
//     const message_2 = await messaging.recieve_group_message(alice);
//     assert(message_2 === b2a.shift());
//
//
//     await messaging.send_group_message(alice, "foobar_group", messages[4]);
//     await messaging.send_group_message(alice, "foobar_group", messages[5])
//     a2b.push(messages[4]);
//     a2b.push(messages[5]);
//     const message_4 = await messaging.recieve_group_message(bob);
//     assert(message_4 === a2b.shift());
//
//     const message_3 = await messaging.recieve_group_message(alice);
//     assert(message_3 === b2a.shift());
//
//     const message_5 = await messaging.recieve_group_message(bob);
//     assert(message_5 === a2b.shift());
//
//     await messaging.send_group_message(bob, alice.pub, messages[6]);
//     await messaging.send_group_message(bob, alice.pub, messages[7]);
//     b2a.push(messages[6]);
//     b2a.push(messages[7]);
//
//     const message_6 = await messaging.recieve_group_message(alice);
//     const message_7 = await messaging.recieve_group_message(alice);
//     assert(message_6 === b2a.shift());
//     assert(message_7 === b2a.shift());
//
//     success();
// }
//
// async function test_single_group_message_send_recieve() {
//     named_log("testing sending a single message from alice to bob in a group");
//     const bob = await user.new_user("bob");
//     const alice = await user.new_user("alice");
//
//     messaging.create_new_group("foo_group", [alice, bob])
//
//     let a2b = [];
//     let b2a = [];
//
//     let messages = [];
//     for (let i = 0; i < 20; i++) {
//         messages.push(Math.random().toString());
//     }
//
//     messages = ["The lazy brown fox jumps over the lazy logs"];
//
//     await messaging.send_group_message(alice, "foo_group", messages[0]);
//     a2b.push(messages[0]);
//
//     const message_0 = await messaging.recieve_group_message(bob);
//
//     assert(message_0 === a2b.shift());
//
//     success();
// }
//
//
// async function test_back_and_forth_two_party_group_send_and_recieve() {
//     named_log("testing non-asyncrynous messaging between alice and bob in a group");
//
//     const bob = await user.new_user("bob");
//     const alice = await user.new_user("alice");
//
//     messaging.create_new_group("foo_group", [alice, bob])
//
//     let a2b = [];
//     let b2a = [];
//
//     let messages = [];
//     for (let i = 0; i < 20; i++) {
//         messages.push(Math.random().toString());
//     }
//
//     await messaging.send_group_message(alice, "foo_group", messages[0]);
//     await messaging.send_group_message(alice, "foo_group", messages[1])
//     a2b.push(messages[0]);
//     a2b.push(messages[1]);
//
//     const message_0 = await messaging.recieve_group_message(bob);
//     const message_1 = await messaging.recieve_group_message(bob);
//     assert(message_0 === a2b.shift());
//     assert(message_1 === a2b.shift());
//
//
//
//     await messaging.send_group_message(bob, "foo_group", messages[2]);
//     await messaging.send_group_message(bob, "foo_group", messages[3]);
//     b2a.push(messages[2]);
//     b2a.push(messages[3]);
//
//     const message_2 = await messaging.recieve_group_message(alice);
//     const message_3 = await messaging.recieve_group_message(alice);
//     assert(message_2 === b2a.shift());
//     assert(message_3 === b2a.shift());
//
//     await messaging.send_group_message(alice, "foo_group", messages[4]);
//     await messaging.send_group_message (alice, "foo_group", messages[5])
//     a2b.push(messages[4]);
//     a2b.push(messages[5]);
//
//     const message_4 = await messaging.recieve_group_message(bob);
//     const message_5 = await messaging.recieve_group_message(bob);
//     assert(message_4 === a2b.shift());
//     assert(message_5 === a2b.shift());
//
//
//
//     await messaging.send_group_message(bob, "foo_group", messages[6]);
//     await messaging.send_group_message(bob, "foo_group", messages[7]);
//     b2a.push(messages[6]);
//     b2a.push(messages[7]);
//
//     const message_6 = await messaging.recieve_group_message(alice);
//     const message_7 = await messaging.recieve_group_message(alice);
//     assert(message_6 === b2a.shift());
//     assert(message_7 === b2a.shift());
//
//     success();
// }
//
// export async function test_small_group_messaging() {
//     named_log("testing sending messages to a small group of people")
//
//     const bob = await user.new_user("bob");
//     const alice = await user.new_user("alice");
//     const carol = await user.new_user("carol");
//
//     let a2b = [];
//     let a2c = [];
//     let b2a = [];
//     let b2c = [];
//     let c2a = [];
//     let c2b = [];
//
//     messaging.create_new_group("foo_group", [alice, bob, carol])
//
//     let messages = [];
//     for (let i = 0; i < 20; i++) {
//         messages.push(Math.random().toString());
//     }
//
//     await messaging.send_group_message(alice, "foo_group", messages[0]);
//     await messaging.send_group_message(alice, "foo_group", messages[1])
//     a2b.push(messages[0]);
//     a2b.push(messages[1]);
//     a2c.push(messages[0]);
//     a2c.push(messages[1]);
//
//     const message_0_b = await messaging.recieve_group_message(bob);
//     const message_1_b = await messaging.recieve_group_message(bob);
//     assert(message_0_b === a2b.shift());
//     assert(message_1_b === a2b.shift());
//
//     const message_0_c = await messaging.recieve_group_message(carol);
//     const message_1_c = await messaging.recieve_group_message(carol);
//     assert(message_0_c === a2c.shift());
//     assert(message_1_c === a2c.shift());
//
//     await messaging.send_group_message(bob, "foo_group", messages[2]);
//     await messaging.send_group_message(bob, "foo_group", messages[3])
//     b2a.push(messages[2]);
//     b2a.push(messages[3]);
//     b2c.push(messages[2]);
//     b2c.push(messages[3]);
//
//     const message_2_a = await messaging.recieve_group_message(alice);
//     const message_3_a = await messaging.recieve_group_message(alice);
//     assert(message_2_a === b2a.shift());
//     assert(message_3_a === b2a.shift());
//
//     const message_2_c = await messaging.recieve_group_message(carol);
//     const message_3_c = await messaging.recieve_group_message(carol);
//     assert(message_2_c === b2c.shift());
//     assert(message_3_c === b2c.shift());
//
//     await messaging.send_group_message(alice, "foo_group", messages[4]);
//     await messaging.send_group_message(alice, "foo_group", messages[5])
//     a2b.push(messages[4]);
//     a2b.push(messages[5]);
//     a2c.push(messages[4]);
//     a2c.push(messages[5]);
//
//     const message_4_b = await messaging.recieve_group_message(bob);
//     const message_5_b = await messaging.recieve_group_message(bob);
//     assert(message_4_b === a2b.shift());
//     assert(message_5_b === a2b.shift());
//
//     const message_4_c = await messaging.recieve_group_message(carol);
//     const message_5_c = await messaging.recieve_group_message(carol);
//     assert(message_4_c === a2c.shift());
//     assert(message_5_c === a2c.shift());
//
//     await messaging.send_group_message(carol, "foo_group", messages[6]);
//     await messaging.send_group_message(carol, "foo_group", messages[7])
//     c2a.push(messages[6]);
//     c2a.push(messages[7]);
//     c2b.push(messages[6]);
//     c2b.push(messages[7]);
//
//     const message_6_a = await messaging.recieve_group_message(alice);
//     const message_7_a = await messaging.recieve_group_message(alice);
//     assert(message_6_a === c2a.shift());
//     assert(message_7_a === c2a.shift());
//
//     const message_6_b = await messaging.recieve_group_message(bob);
//     const message_7_b = await messaging.recieve_group_message(bob);
//     assert(message_6_b === c2b.shift());
//     assert(message_7_b === c2b.shift());
//
//     success();
// }
//
// function named_log(name) {
//     let cyan = '\x1b[36m%s\x1b[0m';
//     console.log(cyan, "*******************************");
//     console.log(cyan, name);
//     console.log(cyan, "*******************************");
// }
//
// function success() {
//     let green = "\x1b[32m%s\x1b[0m";
//     console.log(green, "success!");
//     console.log();
// }
