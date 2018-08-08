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

f = open('./nano','r')
nano = f.read()
nano = json.loads(nano)
f.close()

f = open('./time','r')
time = f.read()
time = json.loads(time)
f.close()

plt.plot( nano, time, "blue")

plt.xlabel('input size')
plt.ylabel('time (s)')
plt.title('Algorithm Timing is Fun')
plt.grid(True)
# plt.savefig("test.png")
plt.show()
