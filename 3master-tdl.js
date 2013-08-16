
var threemaster = threemaster || {};

threemaster.makeCamera = function () {

    var distance = 300;
    var viewRotationMatrix = mat4 .create();
    
    mat4 .identity( viewRotationMatrix );

    return {

        zoom : function( delta )
        {
            if ( distance >= delta )
                distance = distance - delta;
        },
        
        setDistance : function( cameraDistance )
        {
            distance = cameraDistance;
        },

        rotate : function( rotation )
        {
            mat4 .multiply( rotation, viewRotationMatrix, viewRotationMatrix );
        },
        
        getPosition : function()
        {
            return [ 0, 0, -distance ];
        },
        
        getRotation : function()
        {
            return viewRotationMatrix;
        }
    
    };
};