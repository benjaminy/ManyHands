#
#
#

MH_DIR=$(PWD)
TEST_DIR=$(MH_DIR)/Testing
TEST_DB=$(TEST_DIR)/Users/login_links.sqlite
TEST_ROOT=$(TEST_DIR)/Root
TEST_CLOUD=$(TEST_DIR)/Cloud
TEST_CERT=$(TEST_DIR)/Cert
SRC_DIR=$(MH_DIR)/Source/WebCrypto

start_file_server:
	node $(SRC_DIR)/../simple_file_server.js --dir $(TEST_CLOUD) --port 8123 --cert $(TEST_CERT)/mh_test_cert.crt --key $(TEST_CERT)/mh_test_server.key

start_mh_server: $(TEST_CERT)/mh_test_server.key copy_everything
	node $(TEST_ROOT)/many_hands_server.js --db $(TEST_DB) --front $(SRC_DIR) --cert $(TEST_CERT)/mh_test_cert.crt --key $(TEST_CERT)/mh_test_server.key

copy_everything:
	mkdir -p $(TEST_ROOT)
	cp -r $(SRC_DIR)/* $(TEST_ROOT)

clean_slate:
	cp $(TEST_DIR)/Users/login_links_empty.sqlite $(TEST_DIR)/Users/login_links.sqlite && rm -rf ./Testing/Cloud/*

clean_cert:
	rm $(TEST_CERT)/*

$(TEST_CERT)/mh_test_server.key:
	mkdir -p $(TEST_CERT)
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout $(TEST_CERT)/mh_test_server.key -out $(TEST_CERT)/mh_test_cert.crt
