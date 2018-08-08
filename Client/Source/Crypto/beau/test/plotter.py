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

f = open('./results/nano_array_sorting','r')
input_arr = f.read()
nano_array_sorting = json.loads(input_arr)
f.close()

f = open('./results/nano_array_no_sorting','r')
input_arr = f.read()
nano_array_no_sorting = json.loads(input_arr)
f.close()

f = open('./results/nano_mem_sorting','r')
input_arr = f.read()
nano_mem_sorting = json.loads(input_arr)
f.close()

f = open('./results/nano_mem_no_sorting','r')
input_arr = f.read()
nano_mem_no_sorting = json.loads(input_arr)
f.close()

# -------------------------------------------------------------------- #

f = open('./results/time_array_sorting','r')
input_arr = f.read()
time_array_sorting = json.loads(input_arr)
f.close()

f = open('./results/time_array_no_sorting','r')
input_arr = f.read()
time_array_no_sorting = json.loads(input_arr)
f.close()

f = open('./results/time_mem_sorting','r')
input_arr = f.read()
time_mem_sorting = json.loads(input_arr)
f.close()

f = open('./results/time_mem_no_sorting','r')
input_arr = f.read()
time_mem_no_sorting = json.loads(input_arr)
f.close()

plt.plot( nano_array_sorting, time_array_sorting, "red")
plt.plot( nano_array_no_sorting, time_array_no_sorting, "blue")
plt.plot( nano_mem_sorting, time_mem_sorting, "green")
plt.plot( nano_mem_no_sorting, time_mem_no_sorting, "black")

plt.xlabel('number of messages')
plt.ylabel('time (s)')
plt.title('testing message sending')
plt.grid(True)
# plt.savefig("test.png")
plt.show()
