Fearless Friday Talk Notes
==========================

We live bad times for information security and privacy.
My crystal ball and tea leaf reading for the day: It has only been a decade or two that significant amounts of sensitive information have been reachable over the internet.
In generations to come, this time will be thought of as a weird, wild time before people figured out systems that provide reasonable levels of information protection.

Useful to categorize threats:
- Casino heist stories
- Big data stories
- There are no secrets on the internet stories
- Annoying neighbor stories

### Casino Heist Stories

- OPM - CIA officers pulled from China
- Sony
- Home Depot

Today: Windows update hijacked?
Today: Patreon, T-Mobile applicants

#### Characteristics

- Determined adversary
- Poor operational security
- Data available

### Big Data Stories

- Target pregnant teen
- Mass hospital, voter registration
- Netflix
- Internet of things


#### Characteristics

### There are No Secrets on the Internet Stories

- Ashley Madison
- Activists/rebels
- Snowden
- Today: Yelp revealed data

#### Characteristics

### Annoying Neighbor Stories

- Spam
- Advertising
- Advertising injection

## Encryption

- Hashing
- Symmetric Keyed Encryption
- Public-Key Encryption and Signing

<img src="./aes_act_3_scene_02_agreement_1100.png" alt="Funny cartoon" width="400px">

### Hashing

Cryptographic hash function takes as input (potentially large) blob of raw data and produces as output a number (usually of some fixed size).
Hash functions are deterministic: given the same input they will always produce the same output.
Given an output from a hash function, it is impossible to know for sure what the original input was, because more than one input hashes to the same number.
Given an output from a hash function it _should_ be computationally hard to calculate a table of all inputs (up to a given length) that hash to that number.

### Symmetric Keyed Encryption

1. Confusion
  - Letter replacement
2. Diffusion
  - Letter reordering
3. Secrecy only in the key
  - Xoring

### Public-Key Encryption and Signing

Huge breakthrough in the late 1960s.

Main idea: The secret key is problematic for some applications.
Consider trying to do online banking before the invention of public key cryptography.
The key distribution problem would be very tricky.

Most well-known public key system: RSA
- Private key: two randomly chosen _very_ large prime numbers
- Public key: the product of those numbers

Public key cryptosystems provide two distinct operations:
- Encrypt with public key/decrypt with private key
- Sign with private key/verify with public key

How does this allow us to do online banking securely?
- Bank has an easily findable public key
- User (really user's browser) randomly invents a symmetric key (called a session key)
- Use the bank's public key to encrypt the session key

### Certificates

Bank, DigiCert

## End-to-end encryption

LastPass, Apple iMessages

DBI/DOJ oppose end-to-end encryption

Crypto wars from the 1990s


