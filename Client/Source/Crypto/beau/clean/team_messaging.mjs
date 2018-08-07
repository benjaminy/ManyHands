import * as dr from "./double_ratchet";
import * as crypto from "./crypto_wrappers";
import * as user from "./user";
import * as user_messaging from "./user_messaging";
import * as timestamp_comparison from "./timestamp_comparison";
import * as diffie from "./triple_dh";
import SM from "../../../Storage/in_memory";
import * as SW from "../../../Storage/wrappers";

import assert from "assert";

const groups = {};

let storage = {};

// const mode = "in memory upload";
const mode = "array upload";

export async function create_new_team(group_name, group_members) {
    const new_group = {};

    const s = SM();
    storage = SW.randomNameWrapper(null, s);

    const new_buffer = await crypto.encode_string("The lazy brown fox jumps over the log");

    /*
    body field of options_u object holds the buffer to upload.
    */
    /*
    calling upload on the storage object created above with random name wrapper
    call upload with an object specifyin the path, the header hooks, and the body.
    */
    // const upload_response = await storage.upload(
    //     {path: ["beau", "super_secret_stuff"]}, {header_hooks: [], body: new_buffer}
    // );
    // // Checking that the upload response was ok.
    // if (!upload_response.ok) {
    //     throw new Error("upload didn't work");
    // }

    // has the path as an array as well as the name of the file that was made.
    // console.log("The file pointer from uploading the message", upload_response.file_ptr);

    // Download gets called with the file pointer object... not sure what the other thing is
    // const download_response = await storage.download(upload_response.file_ptr, {});
    // if (!download_response.ok) {
    //     throw new Error("the download didnt work!");
    // }
    // const data = await download_response.arrayBuffer();
    // console.log("decoded download!!!!!!!!:", await crypto.decode_string(data));

    new_group[group_name] = [];

    // initializing curr memebrs pub and priv group variables
    // need to initialize the members with a triple diffie hellman too.

    for (let i = 0; i < group_members.length; i++) {
        const curr_member = group_members[i];
        const pub1 = curr_member.pub;
        const priv1 = curr_member.priv;

        new_group[group_name].push(pub1.uid);

        pub1.teams[group_name] = {};
        pub1.teams[group_name].outbox = [];

        priv1.teams[group_name] = {};
        priv1.teams[group_name].timestamp = {};
        priv1.teams[group_name].timestamp[pub1.uid] = 0;

        priv1.teams[group_name].counter = 0;
        priv1.teams[group_name].members = [];
        priv1.teams[group_name].log = [];


        pub1.users[group_name] = {};

        for (let j = 0; j < group_members.length; j++) {
            if (i != j) {
                const other_member = group_members[j]
                const pub2 = other_member.pub;
                const priv2 = other_member.priv;

                priv1.teams[group_name].timestamp[pub2.uid] = 0;

                pub1.users[group_name][pub2.uid] = {};
                pub1.users[group_name][pub2.uid].outbox = [];

                priv1.teams[group_name].members.push(pub2);
                // need to do a tiple diffie hellman with them to fill the conversation keys


                if (i < j) {
                    const sender_diffie_out = await diffie.sender_triple_diffie_hellman(priv1, pub2);
                    const sender_shared_secret = sender_diffie_out.shared_secret;
                    const sender_ephemeral_key = sender_diffie_out.ephemeral_public_key;

                    const new_key = await crypto.generate_dh_key();

                    // Sender conversation gets initialized
                    const sender_conversation = await user.init_conversation_keys(sender_shared_secret);

                    // Sender recieve key gets set to the reciever prekey
                    sender_conversation.recieve_key = pub2.prekey;

                    // Sender Send key gets set to the newly generated dh_key
                    sender_conversation.send_key.publicKey = new_key.publicKey;
                    sender_conversation.send_key.privateKey = new_key.privateKey;

                    if (!(group_name in priv1.users)) {
                        priv1.users[group_name] = {};
                    }
                    priv1.users[group_name][pub2.uid] = {};
                    priv1.users[group_name][pub2.uid].conversation = sender_conversation;


                    // Reciever conversation gets intialized
                    const reciever_shared_secret = await diffie.reciever_triple_diffie_hellman(
                        pub1.id_dh, sender_ephemeral_key, priv2
                    );
                    const reciever_conversation = await user.init_conversation_keys(reciever_shared_secret);

                    // Reciever send key is set to their prekey
                    reciever_conversation.send_key.publicKey = pub2.prekey;
                    reciever_conversation.send_key.privateKey = priv2.prekey;

                    // Reciever recieve key is set to the newly generated key
                    reciever_conversation.recieve_key = new_key.publicKey;

                    if (!(group_name in priv2.users)) {
                        priv2.users[group_name] = {};
                    }
                    priv2.users[group_name][pub1.uid] = {};
                    priv2.users[group_name][pub1.uid].conversation = reciever_conversation;

                    assert(new Uint32Array(sender_shared_secret)[0] === new Uint32Array(reciever_shared_secret)[0]);

                }
            }
        }
    };

    Object.assign(groups, new_group);
    return new_group;
}

export async function upload_team_message(sender, group_name, message_to_send) {
    // Increment counter
    sender.priv.teams[group_name].timestamp[sender.pub.uid] += 1;

    const message_timestamp = Object.assign({}, sender.priv.teams[group_name].timestamp);

    const timestamp_buffer = await crypto.encode_object(message_timestamp);
    const timestamp_size = new Uint32Array([new DataView(timestamp_buffer).byteLength]).buffer;

    const message_buffer = await crypto.encode_string(message_to_send);

    const message_to_encrypt = await crypto.combine_buffers(
        [timestamp_size, timestamp_buffer, message_buffer]
    );

    const random_key = await crypto.random_secret();

    const cipher_text = await crypto.encrypt_buffer(random_key, message_to_encrypt);

    let current_message_index = null;
    let download_pointer = {};

    if (mode === "in memory upload") {
        // UPLOADING TEAM MESSAGE
        let upload_response = await storage.upload(
            {path: [sender.pub.uid, group_name]}, {header_hooks: [], body: cipher_text}
        );
        if (!upload_response.ok) {
            throw new Error("upload didn't work");
        }

        download_pointer = {path: [ [sender.pub.uid, group_name], upload_response.file_ptr.path[1] ] };
    }
    else if (mode === "array upload") {
        sender.pub.teams[group_name].outbox.push(cipher_text);
        current_message_index = sender.pub.teams[group_name].outbox.length - 1;
    }

    const team_members = sender.priv.teams[group_name].members;

    for (let i = 0; i < team_members.length; i++) {
        const current_group_member_name = team_members[i].uid;
        const sender_conversation = sender.priv.users[group_name][current_group_member_name].conversation

        let user_message = {};
        if (mode === "in memory upload") {
            user_message = await user_messaging.create_user_message(
                sender_conversation,
                {file_pointer: download_pointer},
                random_key
            );
        }
        else if (mode === "array upload") {
            user_message = await user_messaging.create_user_message(
                sender_conversation,
                {message_index: current_message_index},
                random_key
            );
        }

        sender.pub.users[group_name][current_group_member_name].outbox.push(user_message);
    }
}

export async function download_team_messages(reciever, group_name) {
    const reciever_timestamp = reciever.priv.teams[group_name].timestamp;
    reciever_timestamp[reciever.pub.uid] += 1;

    const team_members = reciever.priv.teams[group_name].members;

    // loop for each team member
    for (let i = 0; i < team_members.length; i++) {
        const sender_pub = team_members[i];

        // loop for each message from a team member
        const new_messages = sender_pub.users[group_name][reciever.pub.uid].outbox;

        for (let j = 0; j < new_messages.length; j++) {
            const current_message = new_messages.shift();
            const parsed_message = await user_messaging.parse_user_message(
                reciever.priv.users[group_name][sender_pub.uid].conversation, current_message
            );

            const message_header = parsed_message.header;
            const encryption_key = parsed_message.message;

            let decrypted_buffer = null;
            if (mode === "in memory upload") {
                // This the downloading of the not real message
                let download_response = await storage.download(message_header.file_pointer, {});

                if (!download_response.ok) {
                    throw new Error("the download didnt work!");
                }
                let downloaded_data = await download_response.arrayBuffer();

                decrypted_buffer = await crypto.decrypt(encryption_key, downloaded_data);

            }
            else if (mode === "array upload") {
                const index_of_group_message = message_header.message_index;
                const group_message = sender_pub.teams[group_name].outbox[index_of_group_message];
                decrypted_buffer = await crypto.decrypt(encryption_key, group_message);
            }


            // THESE ARE THE TWO LINES FOR DOWNLOADING THE OTHER TYPE OF MESSAGE.
            const typed_array = new Uint8Array(decrypted_buffer);
            const timestamp_size = new Uint32Array(typed_array.slice(0, 4).buffer)[0];

            const timestamp_buffer = typed_array.slice(4, (timestamp_size + 4)).buffer;

            const timestamp = await crypto.decode_object(timestamp_buffer);

            const message_buffer = typed_array.slice((timestamp_size + 4), typed_array.length);
            const message = await crypto.decode_string(message_buffer);

            for (let k = 0; k < team_members.length; k++) {
                const curr_member_uid = team_members[k].uid;

                if (timestamp[curr_member_uid] > reciever_timestamp[curr_member_uid]) {
                    reciever_timestamp[curr_member_uid] = timestamp[curr_member_uid];
                }

            }

            reciever.priv.teams[group_name].log.push({timestamp: timestamp, message: message});
            reciever.priv.teams[group_name].log.sort((a, b) => {timestamp_comparison.compare(a.timestamp, b.timestamp)})

        }
    }
}
