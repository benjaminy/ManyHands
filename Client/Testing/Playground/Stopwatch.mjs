

export default function init(){

  let startTime = [NaN,NaN];
  let isStarted = false;

  let endTime = [NaN,NaN];

  function stop(){
    endTime = process.hrtime();
    return (endTime[0]+endTime[1]/1000000) - (startTime[0]+startTime[1]/1000000);
  }

  function start(){
    if (isStarted){
      throw Error("Cant start an already started watch");
    }
    else if(!isStarted){
      startTime = process.hrtime();
    }
  }

  function reset(){
    startTime = [NaN,NaN];
    isStarted = false;
    endTime = [NaN,NaN];
  }

  return {
    reset: reset,
    start: start,
    stop: stop
  }
}
