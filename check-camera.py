"""Analytical projection of the renderer's fit bounds, independent of Three.js/WebGL."""
from math import radians,sin,cos,tan
import json
points=[]
def bounds(x,y,z,hw,h,hd):
    for dx in [-hw,hw]:
        for dz in [-hd,hd]:
            for dy in [0,h]:points.append((x+dx,y+dy,z+dz))
bounds(180,0,280,180,0,280)
for z in [52,508]:bounds(180,0,z,42,122,42)
for x in [53,307]:
    for z in [169,391]:bounds(x,0,z,18,60,18)
bounds(180,0,280,54,50,54)
for x in [45,315]:
    for z in [-11,571]:bounds(x,0,z,13,34 if z>0 else 47,12)
for x in [0,360]:
    for z in [-8,568]:bounds(x,0,z,0,42,0)
f=tan(radians(11))
def project(p,d,aspect):
    a=radians(max(58,min(64,58+(.75-aspect)*24)))
    x,y,z=p[0]-180,p[1]-17,p[2]-280
    depth=d-y*sin(a)-z*cos(a)
    return (x/(depth*f*aspect),(y*cos(a)-z*sin(a))/(depth*f))
result=[]
for w,h in [(320,540),(375,660),(390,689),(430,769),(480,872),(923,1536),(710,950),(320,420)]:
    lo,hi=160,2700
    for _ in range(25):
        d=(lo+hi)/2
        if max(abs(v) for p in points for v in project(p,d,w/h))<.978:hi=d
        else:lo=d
    max_x=max(abs(project(p,hi,w/h)[0]) for p in points);max_y=max(abs(project(p,hi,w/h)[1]) for p in points)
    assert max_x<=.979 and max_y<=.979
    result.append({'canvas':[w,h],'distance':round(hi,2),'max_abs_ndc':[round(max_x,4),round(max_y,4)],'status':'PASS'})
print(json.dumps({'test':'analytical projection only (not actual WebGL)','results':result},indent=2))
