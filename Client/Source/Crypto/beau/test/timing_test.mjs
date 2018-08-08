import * as dr from "../clean/double_ratchet"
import * as crypto from "../clean/crypto_wrappers"
import * as user from "../clean/user"
import * as diffie from "../clean/triple_dh"
import * as team_messaging from "../clean/team_messaging"
import fs from "fs";

async function main() {
    await test_small_message_size();
}
main();

async function test_small_message_size() {
    const bob = await user.new_user("bob");
    const alice = await user.new_user("alice");

    const new_group = await team_messaging.create_new_team("g1", [alice, bob]);

    const a2b = [];
    const b2a = [];

    const messages = [];
    for (let i = 0; i < 20; i++) {
        messages.push(Math.random().toString());
    }
    const results = [];
    const nanoseconds = [];
    const time = [];

    for (let i = 1; i < 1000; i = i * 1.5) {
        const start = new Date().getTime();
        for (let j = 0; j < i; j++) {
            const start = new Date().getTime();

            await team_messaging.upload_team_message(alice, "g1", messages[0]);
            await team_messaging.upload_team_message(alice, "g1", messages[1]);
            a2b.push(messages[0]);
            a2b.push(messages[1]);

            await team_messaging.download_team_messages(bob, "g1");
            await team_messaging.download_team_messages(bob, "g1");

            await team_messaging.upload_team_message(bob, "g1", messages[2]);
            await team_messaging.upload_team_message(bob, "g1", messages[3]);
            b2a.push(messages[2]);
            b2a.push(messages[3]);

            await team_messaging.download_team_messages(alice, "g1");
            await team_messaging.download_team_messages(alice, "g1");

            await team_messaging.upload_team_message(alice, "g1", messages[4]);
            await team_messaging.upload_team_message(alice, "g1", messages[5]);
            a2b.push(messages[4]);
            a2b.push(messages[5]);

            await team_messaging.download_team_messages(bob, "g1");
            await team_messaging.download_team_messages(bob, "g1");

            const end = new Date().getTime();
        }
        const end = new Date().getTime();
        // results.push([i, (end - start)]);
        nanoseconds.push(i);
        time.push(end - start);
    }

    console.log(JSON.stringify(nanoseconds));
    console.log(JSON.stringify(time));

    fs.writeFile("./nano", JSON.stringify(nanoseconds), (err) => {
        if (err) throw err;
        console.log('nanoseconds written');
    });

    fs.writeFile("./time", JSON.stringify(time), (err) => {
        if (err) throw err;
        console.log('runtimes written');
    });
}
