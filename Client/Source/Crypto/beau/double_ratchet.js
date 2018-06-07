const WebCrypto = require("node-webcrypto-ossl");
const WC = new WebCrypto();
const CS = WC.subtle;

let alice_shared_secret = new Int32Array([1490779259, -1036741813, 2138014120,
    -1458188715, -1663956756, 1240908949, 135951678, 1156917335 ]);
let bob_shared_secret = new Int32Array([1490779259, -1036741813, 2138014120,
    -1458188715, -1663956756, 1240908949, 135951678, 1156917335 ]);
let my_salt = new Uint8Array([ 24, 22, 216, 28, 141, 50, 44, 115,
                                117, 65, 243, 62, 117, 42, 115, 78 ]);

let alice_dh_keypair;
let bob_dh_keypair;


async function generate_dh_keypair() {
    let keypair = await CS.generateKey(
        { name: "ECDH", namedCurve: "P-256"},
        true, ["deriveKey", "deriveBits"]
    );
    return keypair;
}


async function setup() {
    alice_dh_keypair = await generate_dh_keypair();
    bob_dh_keypair = await generate_dh_keypair();
}

async function alice_send() {
    alice_dh_keypair = await generate_dh_keypair();
    let dh_shared_secret = await CS.deriveBits(
        {
            name: "ECDH",
            namedCurve: "P-256",
            public: bob_dh_keypair.publicKey,
        },
        alice_dh_keypair.privateKey,
        256
    );

    dh_shared_secret = new Int32Array(dh_shared_secret);

    let kdf_input = new Int32Array(dh_shared_secret.length + alice_shared_secret.length);
    kdf_input.set(dh_shared_secret);
    kdf_input.set(alice_shared_secret, dh_shared_secret.length);

    let kdf_key = await CS.importKey(
        "raw", kdf_input, {name: "PBKDF2"},
        false, ["deriveKey", "deriveBits"]
    );

    let kdf_output = await CS.deriveBits(
        { "name": "PBKDF2", salt: my_salt, iterations: 1000, hash: {name: "SHA-1"} },
        kdf_key, 256
    );

    kdf_output = new Int32Array(kdf_output);

    // console.log(dh_shared_secret);
    // console.log(alice_shared_secret);
    // console.log(kdf_input);
    // console.log(new Int32Array(kdf_output));

    alice_shared_secret = kdf_output;
    console.log(kdf_output)
}

async function alice_recieve() {
    // derive shared secret key with alice...
    let dh_shared_secret = await CS.deriveBits(
        {
            name: "ECDH",
            namedCurve: "P-256",
            public: bob_dh_keypair.publicKey,
        },
        alice_dh_keypair.privateKey,
        256
    );

    dh_shared_secret = new Int32Array(dh_shared_secret);

    //todo: there is most certainly some funkyness here.
    let kdf_input = new Int32Array(dh_shared_secret.length + alice_shared_secret.length);
    kdf_input.set(dh_shared_secret);
    kdf_input.set(alice_shared_secret, dh_shared_secret.length);

    let kdf_key = await CS.importKey(
        "raw", kdf_input, {name: "PBKDF2"},
        false, ["deriveKey", "deriveBits"]
    );

    let kdf_output = await CS.deriveBits(
        { "name": "PBKDF2", salt: my_salt, iterations: 1000, hash: {name: "SHA-1"} },
        kdf_key, 256
    );

    kdf_output = new Int32Array(kdf_output);

    alice_shared_secret = kdf_output;

    console.log(alice_shared_secret);
}

async function bob_recieve() {
    // derive shared secret key with alice...
    let dh_shared_secret = await CS.deriveBits(
        {
            name: "ECDH",
            namedCurve: "P-256",
            public: alice_dh_keypair.publicKey,
        },
        bob_dh_keypair.privateKey,
        256
    );

    dh_shared_secret = new Int32Array(dh_shared_secret);

    let kdf_input = new Int32Array(dh_shared_secret.length + bob_shared_secret.length);
    kdf_input.set(dh_shared_secret);
    kdf_input.set(bob_shared_secret, dh_shared_secret.length);

    let kdf_key = await CS.importKey(
        "raw", kdf_input, {name: "PBKDF2"},
        false, ["deriveKey", "deriveBits"]
    );

    let kdf_output = await CS.deriveBits(
        { "name": "PBKDF2", salt: my_salt, iterations: 1000, hash: {name: "SHA-1"} },
        kdf_key, 256
    );

    kdf_output = new Int32Array(kdf_output);

    bob_shared_secret = kdf_output;

    console.log(bob_shared_secret);
}

async function bob_send() {
    bob_dh_keypair = await generate_dh_keypair();
    let dh_shared_secret = await CS.deriveBits(
        {
            name: "ECDH",
            namedCurve: "P-256",
            public: alice_dh_keypair.publicKey,
        },
        bob_dh_keypair.privateKey,
        256
    );

    dh_shared_secret = new Int32Array(dh_shared_secret);

    let kdf_input = new Int32Array(dh_shared_secret.length + bob_shared_secret.length);
    kdf_input.set(dh_shared_secret);
    kdf_input.set(alice_shared_secret, dh_shared_secret.length);

    let kdf_key = await CS.importKey(
        "raw", kdf_input, {name: "PBKDF2"},
        false, ["deriveKey", "deriveBits"]
    );

    let kdf_output = await CS.deriveBits(
        { "name": "PBKDF2", salt: my_salt, iterations: 1000, hash: {name: "SHA-1"} },
        kdf_key, 256
    );

    kdf_output = new Int32Array(kdf_output);

    // console.log(dh_shared_secret);
    // console.log(alice_shared_secret);
    // console.log(kdf_input);
    // console.log(new Int32Array(kdf_output));

    bob_shared_secret = kdf_output;
    console.log(kdf_output);
}

async function main() {
    await setup();
    await alice_send();
    await bob_recieve();
    console.log("**********************************");
    await bob_send();
    await alice_recieve();
    console.log("**********************************");
    await alice_send();
    await bob_recieve();
    console.log("**********************************");
    await bob_send();
    await alice_recieve();
    console.log("**********************************");
}

main();
