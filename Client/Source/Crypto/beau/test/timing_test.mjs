import * as dr from "../clean/double_ratchet"
import * as crypto from "../clean/crypto_wrappers"
import * as user from "../clean/user"
import * as diffie from "../clean/triple_dh"
import * as team_messaging from "../clean/team_messaging"
import fs from "fs";

async function main() {
    let mode = {};

    mode = {sorting: false, upload: "array"};
    await test_small_message_size(mode);


    mode = {sorting: true, upload: "array"};
    await test_small_message_size(mode);

    mode = {sorting: false, upload: "in-mem"};
    await test_small_message_size(mode);

    mode = {sorting: true, upload: "in-mem"};
    await test_small_message_size(mode);
}
main();


async function test_small_message_size(mode) {
    console.log("******************************************");
    console.log(mode);
    console.log();

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

            await team_messaging.upload_team_message(alice, "g1", messages[0], mode);
            await team_messaging.upload_team_message(alice, "g1", messages[1], mode);
            a2b.push(messages[0]);
            a2b.push(messages[1]);

            await team_messaging.download_team_messages(bob, "g1", mode);
            await team_messaging.download_team_messages(bob, "g1", mode);

            await team_messaging.upload_team_message(bob, "g1", messages[2], mode);
            await team_messaging.upload_team_message(bob, "g1", messages[3], mode);
            b2a.push(messages[2]);
            b2a.push(messages[3]);

            await team_messaging.download_team_messages(alice, "g1", mode);
            await team_messaging.download_team_messages(alice, "g1", mode);

            await team_messaging.upload_team_message(alice, "g1", messages[4], mode);
            await team_messaging.upload_team_message(alice, "g1", messages[5], mode);
            a2b.push(messages[4]);
            a2b.push(messages[5]);

            await team_messaging.download_team_messages(bob, "g1", mode);
            await team_messaging.download_team_messages(bob, "g1", mode);

            const end = new Date().getTime();
        }
        const end = new Date().getTime();
        // results.push([i, (end - start)]);
        nanoseconds.push(i);
        time.push(end - start);
        process.stdout.write(i.toString());
        process.stdout.write(" // ")
    }
    process.stdout.write("\n\n")


    if (mode.upload === "array") {
        if (mode.sorting) {
            fs.writeFile("./results/time_array_sorting", JSON.stringify(time), (err) => {
                if (err) throw err;
                console.log('runtimes written');
            });
            fs.writeFile("./results/nano_array_sorting", JSON.stringify(nanoseconds), (err) => {
                if (err) throw err;
                console.log('nanoseconds written');
            });
        }
        else if (!(mode.sorting)) {
            fs.writeFile("./results/time_array_no_sorting", JSON.stringify(time), (err) => {
                if (err) throw err;
                console.log('runtimes written');
            });
            fs.writeFile("./results/nano_array_no_sorting", JSON.stringify(nanoseconds), (err) => {
                if (err) throw err;
                console.log('nanoseconds written');
            });
        }
    }
    else if (mode.upload === "in-mem") {
        if (mode.sorting) {
            fs.writeFile("./results/time_mem_sorting", JSON.stringify(time), (err) => {
                if (err) throw err;
                console.log('runtimes written');
            });
            fs.writeFile("./results/nano_mem_sorting", JSON.stringify(nanoseconds), (err) => {
                if (err) throw err;
                console.log('nanoseconds written');
            });
        }
        else if (!(mode.sorting)) {
            fs.writeFile("./results/time_mem_no_sorting", JSON.stringify(time), (err) => {
                if (err) throw err;
                console.log('runtimes written');
            });
            fs.writeFile("./results/nano_mem_no_sorting", JSON.stringify(nanoseconds), (err) => {
                if (err) throw err;
                console.log('nanoseconds written');
            });
        }
    }
}
