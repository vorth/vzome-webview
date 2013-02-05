
uniform mat4 viewInverse;
uniform vec3 lightWorldPos;
uniform mat4 worldViewProjection;
uniform mat4 worldInverseTranspose;
uniform mat4 orientations[120];

attribute vec4 position;
attribute vec3 normal;
attribute vec3 worldPosition;
attribute vec4 colorMult;
attribute vec2 orientation;

varying vec4 v_position;
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;
varying vec4 v_colorMult;

void main()
{
    vec4 oriented = ( orientations[ int(orientation.x) ] * position );
    vec4 wp = oriented + vec4(worldPosition, 0);
    v_position = (worldViewProjection * wp);
    vec4 orientedNormal = ( orientations[ int(orientation.x) ] * vec4(normal, 0) );
    v_normal = (worldInverseTranspose * orientedNormal).xyz;
    v_colorMult = colorMult;
    v_surfaceToLight = lightWorldPos - wp.xyz;
    v_surfaceToView = (viewInverse[3] - wp).xyz;
    gl_Position = v_position;
}

