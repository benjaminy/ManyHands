import sys
import json
import numpy as np
import matplotlib.pyplot as plt

def main():
    length = len(sys.argv)
    if length <=1:
        print("Usage (optional <-c> <destpath>for multiple plots on one graph )<filepath> <filepath> <filepath> ....")
        print(" No filepath inputted")
    if sys.argv[1] == "-c":
        plotTogether()
    else:
        counter = 1
        while(counter<length):
            newFilePath = sys.argv[counter]
            processFile(newFilePath)
            counter = counter+1

def plotTogether():
    destPath = sys.argv[2]
    counter = 3
    length = len(sys.argv)
    while(counter<length):
        print("arrived"+str( counter))
        filePath = sys.argv[counter]
        f = open(filePath, "r")
        if f.mode == "r":
            contents = f.read()
            timeArr = json.loads(contents)
        n = len(timeArr)
        values, base = np.histogram(timeArr, bins=n)
        #evaluate the cumulative
        cumulative = np.cumsum(values)
        # plot the cumulative function
        plt.plot(base[:-1], cumulative, c='blue')
        counter = counter+1
    plt.xscale('log')
    plt.savefig(destPath, bbox_inches = "tight", dpi=500)

def processFile(filePath):
    #im running this from ManyHands/ s
    f = open(filePath, "r")
    if f.mode == "r":
        contents = f.read()
        timeArr = json.loads(contents)
    n = len(timeArr)
    values, base = np.histogram(timeArr, bins=n)
    #evaluate the cumulative
    cumulative = np.cumsum(values)
    # plot the cumulative function
    plt.plot(base[:-1], cumulative, c='blue')
    plt.xscale('log')
    fileSansExt = filePath[0:-4]
    plt.savefig(fileSansExt+"png" , bbox_inches = "tight", dpi=500)
    plt.clf()

main()
