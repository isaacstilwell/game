// Pre-baked shader strings — all #pragma glslify dependencies inlined.
// This avoids needing glslify-loader at build time.

// ─── simplex 3D noise (Ian McEwan / Ashima Arts, MIT) ────────────────────────
const SNOISE_3D = `
vec3 _sn_mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 _sn_mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 _sn_permute(vec4 x){return _sn_mod289(((x*34.0)+1.0)*x);}
vec4 _sn_taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=_sn_mod289(i);
  vec4 p=_sn_permute(_sn_permute(_sn_permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=_sn_taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// ─── cellular / Worley noise (Stefan Gustavson, MIT) ─────────────────────────
// mod289(vec3) is intentionally omitted — snoise already defines it as _sn_mod289;
// cellular's permute is a vec3 overload that calls our renamed version.
const CELLULAR3 = `
vec3 _cn_mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 _cn_mod7(vec3 x){return x-floor(x*(1.0/7.0))*7.0;}
vec3 _cn_permute(vec3 x){return _cn_mod289((34.0*x+1.0)*x);}
vec2 cellular(vec3 P){
#define K 0.142857142857
#define Ko 0.428571428571
#define K2 0.020408163265306
#define Kz 0.166666666667
#define Kzo 0.416666666667
#define jitter 1.0
  vec3 Pi=_cn_mod289(floor(P));
  vec3 Pf=fract(P)-0.5;
  vec3 Pfx=Pf.x+vec3(1.0,0.0,-1.0);
  vec3 Pfy=Pf.y+vec3(1.0,0.0,-1.0);
  vec3 Pfz=Pf.z+vec3(1.0,0.0,-1.0);
  vec3 p=_cn_permute(Pi.x+vec3(-1.0,0.0,1.0));
  vec3 p1=_cn_permute(p+Pi.y-1.0);
  vec3 p2=_cn_permute(p+Pi.y);
  vec3 p3=_cn_permute(p+Pi.y+1.0);
  vec3 p11=_cn_permute(p1+Pi.z-1.0);
  vec3 p12=_cn_permute(p1+Pi.z);
  vec3 p13=_cn_permute(p1+Pi.z+1.0);
  vec3 p21=_cn_permute(p2+Pi.z-1.0);
  vec3 p22=_cn_permute(p2+Pi.z);
  vec3 p23=_cn_permute(p2+Pi.z+1.0);
  vec3 p31=_cn_permute(p3+Pi.z-1.0);
  vec3 p32=_cn_permute(p3+Pi.z);
  vec3 p33=_cn_permute(p3+Pi.z+1.0);
  vec3 ox11=fract(p11*K)-Ko; vec3 oy11=_cn_mod7(floor(p11*K))*K-Ko; vec3 oz11=floor(p11*K2)*Kz-Kzo;
  vec3 ox12=fract(p12*K)-Ko; vec3 oy12=_cn_mod7(floor(p12*K))*K-Ko; vec3 oz12=floor(p12*K2)*Kz-Kzo;
  vec3 ox13=fract(p13*K)-Ko; vec3 oy13=_cn_mod7(floor(p13*K))*K-Ko; vec3 oz13=floor(p13*K2)*Kz-Kzo;
  vec3 ox21=fract(p21*K)-Ko; vec3 oy21=_cn_mod7(floor(p21*K))*K-Ko; vec3 oz21=floor(p21*K2)*Kz-Kzo;
  vec3 ox22=fract(p22*K)-Ko; vec3 oy22=_cn_mod7(floor(p22*K))*K-Ko; vec3 oz22=floor(p22*K2)*Kz-Kzo;
  vec3 ox23=fract(p23*K)-Ko; vec3 oy23=_cn_mod7(floor(p23*K))*K-Ko; vec3 oz23=floor(p23*K2)*Kz-Kzo;
  vec3 ox31=fract(p31*K)-Ko; vec3 oy31=_cn_mod7(floor(p31*K))*K-Ko; vec3 oz31=floor(p31*K2)*Kz-Kzo;
  vec3 ox32=fract(p32*K)-Ko; vec3 oy32=_cn_mod7(floor(p32*K))*K-Ko; vec3 oz32=floor(p32*K2)*Kz-Kzo;
  vec3 ox33=fract(p33*K)-Ko; vec3 oy33=_cn_mod7(floor(p33*K))*K-Ko; vec3 oz33=floor(p33*K2)*Kz-Kzo;
  vec3 dx11=Pfx+jitter*ox11; vec3 dy11=Pfy.x+jitter*oy11; vec3 dz11=Pfz.x+jitter*oz11;
  vec3 dx12=Pfx+jitter*ox12; vec3 dy12=Pfy.x+jitter*oy12; vec3 dz12=Pfz.y+jitter*oz12;
  vec3 dx13=Pfx+jitter*ox13; vec3 dy13=Pfy.x+jitter*oy13; vec3 dz13=Pfz.z+jitter*oz13;
  vec3 dx21=Pfx+jitter*ox21; vec3 dy21=Pfy.y+jitter*oy21; vec3 dz21=Pfz.x+jitter*oz21;
  vec3 dx22=Pfx+jitter*ox22; vec3 dy22=Pfy.y+jitter*oy22; vec3 dz22=Pfz.y+jitter*oz22;
  vec3 dx23=Pfx+jitter*ox23; vec3 dy23=Pfy.y+jitter*oy23; vec3 dz23=Pfz.z+jitter*oz23;
  vec3 dx31=Pfx+jitter*ox31; vec3 dy31=Pfy.z+jitter*oy31; vec3 dz31=Pfz.x+jitter*oz31;
  vec3 dx32=Pfx+jitter*ox32; vec3 dy32=Pfy.z+jitter*oy32; vec3 dz32=Pfz.y+jitter*oz32;
  vec3 dx33=Pfx+jitter*ox33; vec3 dy33=Pfy.z+jitter*oy33; vec3 dz33=Pfz.z+jitter*oz33;
  vec3 d11=dx11*dx11+dy11*dy11+dz11*dz11;
  vec3 d12=dx12*dx12+dy12*dy12+dz12*dz12;
  vec3 d13=dx13*dx13+dy13*dy13+dz13*dz13;
  vec3 d21=dx21*dx21+dy21*dy21+dz21*dz21;
  vec3 d22=dx22*dx22+dy22*dy22+dz22*dz22;
  vec3 d23=dx23*dx23+dy23*dy23+dz23*dz23;
  vec3 d31=dx31*dx31+dy31*dy31+dz31*dz31;
  vec3 d32=dx32*dx32+dy32*dy32+dz32*dz32;
  vec3 d33=dx33*dx33+dy33*dy33+dz33*dz33;
  vec3 d1a=min(d11,d12); d12=max(d11,d12); d11=min(d1a,d13); d13=max(d1a,d13); d12=min(d12,d13);
  vec3 d2a=min(d21,d22); d22=max(d21,d22); d21=min(d2a,d23); d23=max(d2a,d23); d22=min(d22,d23);
  vec3 d3a=min(d31,d32); d32=max(d31,d32); d31=min(d3a,d33); d33=max(d3a,d33); d32=min(d32,d33);
  vec3 da=min(d11,d21); d21=max(d11,d21); d11=min(da,d31); d31=max(da,d31);
  d11.xy=(d11.x<d11.y)?d11.xy:d11.yx; d11.xz=(d11.x<d11.z)?d11.xz:d11.zx;
  d12=min(d12,d21); d12=min(d12,d22); d12=min(d12,d31); d12=min(d12,d32);
  d11.yz=min(d11.yz,d12.xy); d11.y=min(d11.y,d12.z); d11.y=min(d11.y,d11.z);
  return sqrt(d11.xy);
#undef K
#undef Ko
#undef K2
#undef Kz
#undef Kzo
#undef jitter
}`;

// ─── getUnitSphereCoords — uses uniforms uResolution, uChunkSize, uChunkOffset, uTransform
const GET_UNIT_SPHERE_COORDS = `
vec3 getUnitSphereCoords(vec2 flipY){
  float z=1.0;
  vec2 textCoord=(flipY.xy-(uResolution/2.0))/((uResolution-1.0)/2.0);
  textCoord=textCoord*uChunkSize+uChunkOffset.xy;
  vec4 transformed=uTransform*vec4(textCoord,z,0.0);
  return normalize(vec3(transformed.xyz));
}`;

// ─── getHeight partial — uses snoise, cellular, getUnitSphereCoords, and all height uniforms
const GET_HEIGHT_FUNCS = `
float normalizeNoise(float n){return clamp(0.5*n+0.5,0.0,1.0);}

float getBase(vec3 p,float pers,int octaves){
  float scale=pow(2.0,float(octaves));
  vec3 displace;
  for(int i=0;i<octaves;i++){
    displace=vec3(
      normalizeNoise(snoise(p.xyz*scale+displace))*pers,
      normalizeNoise(snoise(p.yzx*scale+displace))*pers,
      normalizeNoise(snoise(p.zxy*scale+displace))*pers
    );
    scale*=0.5;
  }
  return normalizeNoise(snoise(p*scale+displace));
}

float getRidges(vec3 p,float pers,int octaves,int maxOctaves,int attenuatedOctaves,float attenuationAmount){
  float total=0.0,frequency=1.0,amplitude=1.0,maxValue=0.0;
  float unattenuatedOctaves=float(octaves-attenuatedOctaves);
  for(int i=0;i<octaves;i++){
    total+=abs(snoise(p*frequency)*amplitude*(1.0-step(unattenuatedOctaves,float(i))*attenuationAmount));
    maxValue+=amplitude; amplitude*=pers; frequency*=2.0;
  }
  for(int i=octaves;i<maxOctaves;i++){ maxValue+=amplitude; amplitude*=pers; }
  return 1.0-sqrt(total/maxValue);
}

float getTopography(vec3 p,int octaves,int maxOctaves,int attenuatedOctaves,float attenuationAmount){
  float base=getBase(p,0.45,octaves);
  float ridges=getRidges(p,0.5,octaves,maxOctaves,attenuatedOctaves,attenuationAmount);
  return (base+ridges*uRidgeWeight)-uRidgeWeight;
}

float getDisplacement(vec3 p,int octaves,int maxOctaves,int attenuatedOctaves,float attenuationAmount){
  p.y*=-1.0;
  p=p*uDispFreq+uSeed;
  float total=0.0,frequency=1.0,amplitude=1.0,maxValue=0.0;
  float unattenuatedOctaves=float(octaves-attenuatedOctaves);
  for(int i=0;i<octaves;i++){
    total+=snoise(p*frequency)*amplitude*(1.0-step(unattenuatedOctaves,float(i))*attenuationAmount);
    maxValue+=amplitude; amplitude*=uDispPersist; frequency*=2.0;
  }
  for(int i=octaves;i<maxOctaves;i++){ maxValue+=amplitude; amplitude*=uDispPersist; }
  return total/maxValue;
}

float getFeatureFadeIn(int currentOctave,int totalOctaves){
  return pow(0.6,3.0-min(3.0,float(totalOctaves-currentOctave)));
}

float getFeatures(vec3 p,int octaves,int neighborPassDeficit,float neighborProximity){
  p=p*uFeaturesFreq+uSeed;
  float varNoise; vec2 cellNoise;
  float craters,rims;
  int age=0;
  float ageMults[3]=float[3](0.75,1.0,1.5);
  float steep=0.0,rimWeight=0.0,rimWidth=0.0,rimVariation=0.0;
  float depthToDiameter=0.0,craterCut=0.0,craterFreq=0.0;
  float craterWidth=0.0,craterDepth=0.0,craterPersist=1.0,octaveFeatures=0.0;
  float totalFeatures=0.0,totalNeighborFeatures=0.0;
  int neighborOctaves=octaves-neighborPassDeficit;
  for(int i=0;i<octaves;i++){
    craterFreq=pow(uCraterFalloff,float(i));
    craterCut=uCraterCut-0.075*(1.0-1.0/craterFreq);
    craterWidth=0.25*uLandscapeWidth/craterFreq;
    depthToDiameter=clamp(0.4*smoothstep(0.0,1.0,1.0-log(craterWidth)/13.0),0.05,0.4);
    age=craterWidth>30000.0?0:i%3;
    rimWeight=uRimWeight*ageMults[age];
    rimWidth=craterCut*uRimWidth*ageMults[2-age];
    rimVariation=uRimVariation*ageMults[2-age];
    craterDepth=depthToDiameter*craterWidth*((ageMults[age]+1.0)/3.5)*craterPersist;
    steep=uCraterSteep*ageMults[age];
    varNoise=snoise(craterFreq*4.0*(p+uSeed));
    cellNoise=cellular(craterFreq*0.5*(p+uSeed))+varNoise*rimVariation;
    craters=pow(smoothstep(0.0,craterCut,cellNoise.x),steep)-1.0;
    rims=(1.0-smoothstep(craterCut,craterCut+rimWidth,cellNoise.x))*rimWeight;
    octaveFeatures=craterDepth*(craters+rims);
    totalFeatures+=octaveFeatures*getFeatureFadeIn(i,octaves);
    totalNeighborFeatures+=octaveFeatures*getFeatureFadeIn(i,neighborOctaves)*(1.0-step(float(neighborOctaves),float(i)));
  }
  totalFeatures/=uMaxCraterDepth;
  totalFeatures=sign(totalFeatures)*pow(abs(totalFeatures),uFeaturesSharpness);
  totalNeighborFeatures/=uMaxCraterDepth;
  totalNeighborFeatures=sign(totalNeighborFeatures)*pow(abs(totalNeighborFeatures),uFeaturesSharpness);
  return mix(totalFeatures,totalNeighborFeatures,neighborProximity);
}

vec4 getHeight(vec3 point,int neighborPassDeficit,float neighborProximity){
  float uCoarseDispFraction=1.0-uFineDispFraction;
  float disp=getDisplacement(point,uDispPasses+uExtraPasses,uDispPasses+uExtraPassesMax,neighborPassDeficit,neighborProximity);
  point=point*(1.0+disp*uCoarseDispFraction*uDispWeight)*uStretch;
  float topo=getTopography(point,uTopoDetail+uExtraPasses,uTopoDetail+uExtraPassesMax,neighborPassDeficit,neighborProximity);
  float features=getFeatures(point,uCraterPasses+uExtraPasses-1,neighborPassDeficit,neighborProximity);
  float fine=(topo*uTopoWeight+features*2.0)/(uTopoWeight+1.5);
  float height=normalizeNoise(uCoarseDispFraction*disp+uFineDispFraction*fine);
  return vec4(floor(height*255.0)/255.0,fract(height*255.0),normalizeNoise(topo),0.0);
}
vec4 getHeight(vec2 flipY,int neighborPassDeficit,float neighborProximity){
  return getHeight(getUnitSphereCoords(flipY),neighborPassDeficit,neighborProximity);
}
vec4 getHeight(vec2 flipY){return getHeight(flipY,0,0.0);}`;


// ─── height uniforms (shared between height and height_w_stitching) ───────────
const HEIGHT_UNIFORMS = `
uniform vec2 uChunkOffset;
uniform float uChunkSize;
uniform float uCraterCut;
uniform float uCraterFalloff;
uniform int uCraterPasses;
uniform float uCraterPersist;
uniform float uCraterSteep;
uniform float uDispFreq;
uniform int uDispPasses;
uniform float uDispPersist;
uniform float uDispWeight;
uniform int uExtraPasses;
uniform int uExtraPassesMax;
uniform float uFeaturesSharpness;
uniform float uFeaturesFreq;
uniform float uFineDispFraction;
uniform float uLandscapeWidth;
uniform float uMaxCraterDepth;
uniform bool uOversampling;
uniform float uResolution;
uniform float uRidgeWeight;
uniform float uRimVariation;
uniform float uRimWeight;
uniform float uRimWidth;
uniform vec3 uSeed;
uniform vec3 uStretch;
uniform int uTopoDetail;
uniform float uTopoFreq;
uniform float uTopoWeight;
uniform mat4 uTransform;`;

// ═══════════════════════════════════════════════════════════════════════════════
// Exported shader strings
// ═══════════════════════════════════════════════════════════════════════════════

export const heightShader = `
${HEIGHT_UNIFORMS}
${GET_UNIT_SPHERE_COORDS}
${SNOISE_3D}
${CELLULAR3}
${GET_HEIGHT_FUNCS}
void main(){
  vec2 flipY=vec2(gl_FragCoord.x,uResolution-gl_FragCoord.y);
  gl_FragColor=getHeight(flipY);
}`;

export const heightShaderWithStitching = `
${HEIGHT_UNIFORMS}
uniform float uEdgeStrideN;
uniform float uEdgeStrideS;
uniform float uEdgeStrideE;
uniform float uEdgeStrideW;
${GET_UNIT_SPHERE_COORDS}
${SNOISE_3D}
${CELLULAR3}
${GET_HEIGHT_FUNCS}
void main(){
  vec2 flipY=vec2(gl_FragCoord.x,uResolution-gl_FragCoord.y);
  float oversampleAddOn=uOversampling?1.0:0.0;
  float edgeDistance=0.5+oversampleAddOn;
  float attenuationDistance=0.5+oversampleAddOn+floor(uResolution/10.0);
  float strideX=flipY.y<=edgeDistance?uEdgeStrideS:(flipY.y>=uResolution-edgeDistance?uEdgeStrideN:1.0);
  float x=flipY.x-edgeDistance;
  float strideModX=mod(x,strideX);
  float strideY=flipY.x<=edgeDistance?uEdgeStrideW:(flipY.x>=uResolution-edgeDistance?uEdgeStrideE:1.0);
  float y=flipY.y-edgeDistance;
  float strideModY=mod(y,strideY);
  int neighborPassDeficit=int(max(
    flipY.y<=attenuationDistance?uEdgeStrideS:(flipY.y>=uResolution-attenuationDistance?uEdgeStrideN:1.0),
    flipY.x<=attenuationDistance?uEdgeStrideW:(flipY.x>=uResolution-attenuationDistance?uEdgeStrideE:1.0)
  ))-1;
  float neighborProximity=min(
    attenuationDistance-oversampleAddOn,
    max(
      flipY.y<=attenuationDistance?attenuationDistance-flipY.y:(flipY.y>=uResolution-attenuationDistance?attenuationDistance-(uResolution-flipY.y):0.0),
      flipY.x<=attenuationDistance?attenuationDistance-flipY.x:(flipY.x>=uResolution-attenuationDistance?attenuationDistance-(uResolution-flipY.x):0.0)
    )
  )/(attenuationDistance-oversampleAddOn);
  float mixAmount=max(strideModX/strideX,strideModY/strideY);
  vec2 point1=vec2(
    strideModX>0.0?floor(x/strideX)*strideX+edgeDistance:flipY.x,
    strideModY>0.0?floor(y/strideY)*strideY+edgeDistance:flipY.y
  );
  vec4 output1=getHeight(point1,neighborPassDeficit,neighborProximity);
  float height1=(output1.x*255.0+output1.y)/255.0;
  float topo1=output1.z;
  vec2 point2=vec2(
    strideModX>0.0?ceil(x/strideX)*strideX+edgeDistance:flipY.x,
    strideModY>0.0?ceil(y/strideY)*strideY+edgeDistance:flipY.y
  );
  vec4 output2=getHeight(point2,neighborPassDeficit,neighborProximity);
  float height2=(output2.x*255.0+output2.y)/255.0;
  float topo2=output2.z;
  float height=mix(height1,height2,mixAmount);
  float topo=mix(topo1,topo2,mixAmount);
  gl_FragColor=vec4(floor(height*255.0)/255.0,fract(height*255.0),topo,0.0);
}`;

