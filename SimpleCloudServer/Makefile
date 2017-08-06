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
NODE_CMD=nodejs

start_file_server: $(TEST_CERT)/mh_test_server.key
	$(NODE_CMD) $(SRC_DIR)/../simple_file_server.js --dir $(TEST_CLOUD) --port 8123 --cert $(TEST_CERT)/mh_test_cert.crt --key $(TEST_CERT)/mh_test_server.key

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

install_node_modules:
	cd Testing
	npm install serve-static
	npm install finalhandler
	npm install node-getopt
	npm install multiparty
	sudo npm install -g node-pre-gyp
	npm install --no-bin-links sqlite3
#	export NODE_PATH=$PWD/node_modules
#	npm install babel-preset-es2015
#	npm install babel-plugin-transform-es2015-modules-systemjs
	cd ..
