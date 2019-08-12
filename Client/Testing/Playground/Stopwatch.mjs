

export default function init(){

  let startTime = null;
  let isStarted = false;

  let endTime = null;

  function print(){
    console.log(isStarted,"  ",startTime[0]+startTime[1]/1000000,"  ",endTime[0]+endTime[1]/1000000)
  }

  function stop(){
    endTime = process.hrtime.bigint();
    return endTime-startTime;
    //(endTime[0]+endTime[1]/1000000) - (startTime[0]+startTime[1]/1000000);
  }

  function start(){
    if (isStarted){
      throw Error("Cant start an already started watch");
    }
    else if(!isStarted){
      startTime = process.hrtime.bigint();
    }
  }

  function reset(){
    startTime = null;
    isStarted = false;
    endTime = null;
  }

  return {
    print:print,
    reset: reset,
    start: start,
    stop: stop
  }
}
