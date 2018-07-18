import * as dr from "../clean/double_ratchet"
import * as crypto from "../clean/crypto_wrappers"
import * as user from "../clean/user"
import * as diffie from "../clean/triple_dh"
import * as messaging from "../clean/messaging"

async function main() {
    await test_small_message_size();
}
main();

async function test_small_message_size() {
    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    messaging.create_new_group("foobar_group", [alice, bob])

    let a2b = [];
    let b2a = [];

    let messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }
    const results = [];

    for (let i = 1; i < 1000; i = i * 1.5) {
        const start = new Date().getTime();
        for (let j = 0; j < i; j++) {
            const start = new Date().getTime();

            await messaging.send_group_message(alice, "foobar_group", Math.random().toString());
            await messaging.send_group_message(alice, "foobar_group", Math.random().toString());
            await messaging.recieve_group_message(bob);
            await messaging.recieve_group_message(bob);

            await messaging.send_group_message(bob, "foobar_group", Math.random().toString());
            await messaging.send_group_message(bob, "foobar_group", Math.random().toString());
            await messaging.recieve_group_message(alice);
            await messaging.recieve_group_message(alice);

            const end = new Date().getTime();
        }
        const end = new Date().getTime();
        results.push([i, (end - start)]);
    }

    console.log(JSON.stringify(results));



}
