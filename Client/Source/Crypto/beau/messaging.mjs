import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    // TODO: 2 rearragnge encrypt and decrypt

    // TODO: 3 Implement the sign and verify function of the messaging system.

    // TODO: 4 DH with multiple inputs

    // TODO: 5 Stub out plan for Ratchet and for KDF CHAIN.


    let alice = await user("alice");
    let bob = await user("bob");

    let message = "the lazy brown fox jumps over the log";
    let encryption_key = await WC.getRandomValues(new Uint8Array(16));

    let sent_message =  await alice.send_message(encryption_key, message);
    // let recieved_message = await bob.recieve_message("mensaje numero dos!");

    // console.log("SENT MESSAGE");
    // console.log(sent_message);
    // console.log("RECIEVED MESSAGE");
    // console.log(recieved_message);
}

/*
TODO: you want to be able to encrypt a message
    pass the encryption key as parameter to the message
        returns an encrypted message

TODO: you want to be able to sign a message
    pass a decryption key to the message, and returns a decrypted message


*/

async function user(name) {
    let u = {}
    u.name = name;

    // u.send_message = async function(encryption_key, signing_key, message) {
    u.send_message = async function(encryption_key, message) {
        /*
        encryption_key -- the derived shared secret key from alice
        signing_key -- the key she will use to sign
        message -- the plain text message
        TODO: implement the encryption of this message
        */

        let message_buffer = Encoder.encode(message);

        let cbc_key = await CS.generateKey(
            { name: "AES-CBC", length: 256 }, false, ["encrypt", "decrypt"]
        );

        let encryption = await CS.encrypt(
            {
                name: "AES-CBC",
                iv: encryption_key,
            },
            cbc_key, //from generateKey or importKey above
            message_buffer //ArrayBuffer of data you want to encrypt
        )

        console.log(encryption)

        let decryption_buffer = await CS.decrypt (
            {
                name: "AES-CBC",
                iv: encryption_key,
            },
            cbc_key, //from generateKey or importKey above
            encryption //ArrayBuffer of data you want to encrypt
        );

        let decryption = Decoder.decode(decryption_buffer);
        console.log(decryption);

        /*
        TODO: need to sign a message
            Not really sure what exact key you are using to sign... does it just stay you identity key?

        */
        return message;
    }

    u.recieve_message = async function(decryptionKey, verify_key, encrypted_message) {
        /*
        decryptionKey -- What bob derives on his end using his current knowledge
                         including all of his shared keys and such....
        verify_key -- Alices public identity key
        encrypted_message -- The encrypted message from alice
        */
        // TODO: implement the decryption of this message
            // This will use the same algorithm as the encryption

        // TODO: need to verify a message
            // use the senders identity public key.

        return message;
    }

    return u;
}

main();
