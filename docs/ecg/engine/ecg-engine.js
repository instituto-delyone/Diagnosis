const PAPER={25:{smallSquareMs:40,largeSquareMs:200},50:{smallSquareMs:20,largeSquareMs:100}};
const GAIN={"N":0.1,"N/2":0.2,"2N":0.05};

export function validateRecording(record={}){
  const speed=Number(record.paper_speed_mm_s??25), gain=record.gain??"N";
  return {valid:PAPER[speed]!==undefined&&GAIN[gain]!==undefined,paper_speed_mm_s:speed,gain};
}
export function smallSquaresToMs(n,speed=25){if(!PAPER[speed])throw new Error("Unsupported paper speed");return Number(n)*PAPER[speed].smallSquareMs;}
export function largeSquaresToMs(n,speed=25){if(!PAPER[speed])throw new Error("Unsupported paper speed");return Number(n)*PAPER[speed].largeSquareMs;}
export function heartRateFromRRSmallSquares(n){return 1500/Number(n);}
export function heartRateFromRRLargeSquares(n){return 300/Number(n);}
export function heartRateFromThreeSeconds(rCount){return Number(rCount)*20;}
export function bazettQTc(qtMs,rrSeconds){return Number(qtMs)/Math.sqrt(Number(rrSeconds));}
export function analyzeBasic(record={}){
  const validation=validateRecording(record);
  return {validation,heart_rate:record.rr_small_squares?heartRateFromRRSmallSquares(record.rr_small_squares):null,qtc_bazett:record.qt_ms&&record.rr_seconds?bazettQTc(record.qt_ms,record.rr_seconds):null};
}