/**
 * Created by ys2n on 2/17/16.
 */
const PATHS = ["/13735/13740",
    "/13735/13740/13734/1/5324/5904/8607",
    "/13735/13740/13734/427/5421/5550/20700",
    "/735/13740/13734/427/5421/5550/20700"];


//QUnit.test( "showPaths multiple", function( assert ) {
//    assert.expect(4);
//    QUnit.ok(1 == 1, "Hey that's OK");
//    var ktree = $('#tree');
//    // ktree.fancytree().on('ok', function() { console.log("burp")});
//
//    QUnit.ok(ktree, "We got a tree!");
//    ktree.kmapsTree('showPaths',["/13735/13740","/13735/13740/13734/1/5324/5904/8607","/13735/13740/13734/427/5421/5550/20700","/735/13740/13734/427/5421/5550/20700"], function() { assert.ok(true)});
//}); oijoijoijoijoi
for (var i = 0; i < PATHS.length; i++) {
    var kid = PATHS[i];
    QUnit.test("showPaths "  + kid), function () {
        assert.expect(1);
        var ktree = $('#tree');
            ktree.kmapsTree('showPaths', kid, function () {
            });
    }
}
