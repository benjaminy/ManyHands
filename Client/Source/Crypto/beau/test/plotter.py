import matplotlib.pyplot as plt
import json

ns     = []
random_times  = []
best_times = []
worst_times = []
timesr = []
min_i  = 2
max_i  = 27
n_base = 1.3

f = open('./results_with_crypto/nano_array_sorting','r')
input_arr = f.read()
nano_array_sorting = json.loads(input_arr)
f.close()

f = open('./results_with_crypto/nano_array_no_sorting','r')
input_arr = f.read()
nano_array_no_sorting = json.loads(input_arr)
f.close()

f = open('./results_with_crypto/nano_mem_sorting','r')
input_arr = f.read()
nano_mem_sorting = json.loads(input_arr)
f.close()

f = open('./results_with_crypto/nano_mem_no_sorting','r')
input_arr = f.read()
nano_mem_no_sorting = json.loads(input_arr)
f.close()

# -------------------------------------------------------------------- #

f = open('./results_with_crypto/time_array_sorting','r')
input_arr = f.read()
time_array_sorting = json.loads(input_arr)
f.close()

f = open('./results_with_crypto/time_array_no_sorting','r')
input_arr = f.read()
time_array_no_sorting = json.loads(input_arr)
f.close()

f = open('./results_with_crypto/time_mem_sorting','r')
input_arr = f.read()
time_mem_sorting = json.loads(input_arr)
f.close()

f = open('./results_with_crypto/time_mem_no_sorting','r')
input_arr = f.read()
time_mem_no_sorting = json.loads(input_arr)
f.close()


# -------------------------------------------------------------------- #
# -------------------------------------------------------------------- #
# -------------------------------------------------------------------- #

f = open('./results_without_crypto/nano_array_sorting','r')
input_arr = f.read()
nano_array_sorting_no_crypto = json.loads(input_arr)
f.close()

f = open('./results_without_crypto/nano_array_no_sorting','r')
input_arr = f.read()
nano_array_no_sorting_no_crypto = json.loads(input_arr)
f.close()

f = open('./results_without_crypto/nano_mem_sorting','r')
input_arr = f.read()
nano_mem_sorting_no_crypto = json.loads(input_arr)
f.close()

f = open('./results_without_crypto/nano_mem_no_sorting','r')
input_arr = f.read()
nano_mem_no_sorting_no_crypto = json.loads(input_arr)
f.close()

# -------------------------------------------------------------------- #

f = open('./results_without_crypto/time_array_sorting','r')
input_arr = f.read()
time_array_sorting_no_crypto = json.loads(input_arr)
f.close()

f = open('./results_without_crypto/time_array_no_sorting','r')
input_arr = f.read()
time_array_no_sorting_no_crypto = json.loads(input_arr)
f.close()

f = open('./results_without_crypto/time_mem_sorting','r')
input_arr = f.read()
time_mem_sorting_no_crypto = json.loads(input_arr)
f.close()

f = open('./results_without_crypto/time_mem_no_sorting','r')
input_arr = f.read()
time_mem_no_sorting_no_crypto = json.loads(input_arr)
f.close()


# plt.plot( nano_array_sorting, time_array_sorting, "red")
# plt.plot( nano_array_no_sorting, time_array_no_sorting, "blue")
plt.plot( nano_mem_sorting, time_mem_sorting, "green")
# plt.plot( nano_mem_no_sorting, time_mem_no_sorting, "black")

# plt.plot( nano_array_sorting_no_crypto, time_array_sorting_no_crypto, "red")
# plt.plot( nano_array_no_sorting_no_crypto, time_array_no_sorting_no_crypto, "blue")
plt.plot( nano_mem_sorting_no_crypto, time_mem_sorting_no_crypto, "black")
# plt.plot( nano_mem_no_sorting_no_crypto, time_mem_no_sorting_no_crypto, "black")

plt.xlabel('number of messages')
plt.ylabel('time (s)')
plt.title('testing message sending')
plt.grid(True)
# plt.savefig("test.png")
plt.show()
