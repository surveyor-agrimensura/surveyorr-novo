export type RouteTransitionDetail={confirmations:Promise<boolean>[]};
export type RouteTransitionRequest={allowed:boolean;confirmations:Promise<boolean>[]};

export function dispatchRouteTransitionRequest():RouteTransitionRequest{
 const detail:RouteTransitionDetail={confirmations:[]};
 const event=new CustomEvent<RouteTransitionDetail>('surveyor:before-route-change',{cancelable:true,detail});
 const allowed=window.dispatchEvent(event);
 return {allowed,confirmations:detail.confirmations};
}

export async function requestRouteTransition():Promise<boolean>{
 const request=dispatchRouteTransitionRequest();
 return resolveRouteTransitionRequest(request);
}

export async function resolveRouteTransitionRequest(request:RouteTransitionRequest):Promise<boolean>{
 if(request.confirmations.length){
  const results=await Promise.all(request.confirmations);
  return results.every(Boolean);
 }
 return request.allowed;
}

export function addRouteTransitionConfirmation(event:Event,confirmation:Promise<boolean>):void{
 const detail=(event as CustomEvent<RouteTransitionDetail>).detail;
 if(!detail||!Array.isArray(detail.confirmations)){event.preventDefault();return;}
 event.preventDefault();
 detail.confirmations.push(confirmation);
}
