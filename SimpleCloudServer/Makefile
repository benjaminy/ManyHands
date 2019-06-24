#
#
#

MH_DIR=$(PWD)
TEST_DIR=$(MH_DIR)/Testing
TEST_CERT=$(TEST_DIR)/Cert
SRC_DIR=$(MH_DIR)/Source
NODE_CMD=node --experimental-modules

start_file_server: $(TEST_CERT)/mh_test_server.key
	$(NODE_CMD) $(SRC_DIR)/simple_file_server_level.mjs --db $(TEST_DIR)/Cloud/Default --port 8123
#	$(NODE_CMD) $(SRC_DIR)/simple_file_server.js --dir $(TEST_DIR) --port 8123
#	$(NODE_CMD) $(SRC_DIR)/simple_file_server.js --dir $(TEST_DIR) --port 8123 --cert $(TEST_CERT)/mh_test_cert.crt --key $(TEST_CERT)/mh_test_server.key

clean_data:
	rm -rf $(TEST_DIR)/Cloud/Default/*

clean_slate:
	rm -rf ./Testing/*

clean_cert:
	rm $(TEST_CERT)/*

$(TEST_CERT)/mh_test_server.key:
	mkdir -p $(TEST_CERT)
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout $(TEST_CERT)/mh_test_server.key -out $(TEST_CERT)/mh_test_cert.crt

install_node_modules:
	cd Testing
	npm install multiparty
	sudo npm install -g node-pre-gyp
	npm install --no-bin-links sqlite3
#	export NODE_PATH=$PWD/node_modules
#	npm install babel-preset-es2015
#	npm install babel-plugin-transform-es2015-modules-systemjs
	cd ..
