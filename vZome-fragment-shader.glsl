
#ifdef GL_ES
precision highp float;
#endif

varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;
varying vec4 v_colorMult;

uniform vec4 specular;
uniform float shininess;
uniform float specularFactor;

vec4 lit( float l ,float h, float m )
{
    return vec4( 1.0, max(l, 0.0), (l > 0.0) ? pow(max(0.0, h), m) : 0.0, 1.0 );
}

void main()
{
    vec3 normal = normalize( v_normal );
    vec3 surfaceToLight = normalize( v_surfaceToLight );
    vec3 surfaceToView = normalize( v_surfaceToView );
    vec3 halfVector = normalize( surfaceToLight + surfaceToView );
    vec4 litR = lit( dot( normal, surfaceToLight ), dot( normal, halfVector ), shininess );
    gl_FragColor = vec4( ( vec4(1,1,1,1) * (v_colorMult * litR.y + specular * litR.z * specularFactor) ).rgb, 1.0 );
}
