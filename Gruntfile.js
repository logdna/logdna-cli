var os = require('os');
var grunt = require('grunt');
var path = require('path');
var pkg = require('./package.json');

require('load-grunt-tasks')(grunt);

module.exports = function(grunt) {
    var files = ['./index.js', './Gruntfile.js', 'lib/**/*.js', 'test/**/*.js'];
    var buildOutputFile = os.platform() !== 'win32' ? 'logdna' : 'logdna.exe';

    grunt.initConfig({
        lineremover: {
            nukebrowser: {
                files: {
                    'node_modules/ws/package.json': path.join('node_modules', 'ws', 'package.json')
                }
                , options: {
                    exclusionPattern: /browser/
                }
            }
        }, exec: {
            nexe: {
                cmd: 'nexe -i index.js -o ' + buildOutputFile + ' -f -t ~/tmp -r 8.11.3'
                , maxBuffer: 20000 * 1024
            }, save_version: 'echo ' + pkg.version + ' > version'
            , nexe_win: {
                cmd: 'nexe -i index.js -o logdna.exe -f -t ~/tmp -r 8.11.3'
                , maxBuffer: 20000 * 1024
            }, fpm_osxpkg: 'fpm -s dir -t osxpkg --osxpkg-identifier-prefix com.logdna -n logdna-cli -v ' + pkg.version + ' --post-install ./scripts/post-install -f ./logdna=/usr/local/logdna/bin/logdna'
            , sign_pkg: 'productsign --sign "Developer ID Installer: Answerbook, Inc. (TT7664HMU3)" logdna-cli-' + pkg.version + '.pkg logdna-cli.pkg'
            , verify_pkg: 'spctl -a -t install -vv logdna-cli.pkg'
            , rm_unsignedpkg: 'rm logdna-cli-' + pkg.version + '.pkg'
            , install_pkg: 'sudo installer -verbose -pkg logdna-cli.pkg -target /'
            , gzip_macbin: 'gzip -kf ./logdna'
            , upload_macbin: 'aws s3 cp ./logdna.gz s3://repo.logdna.com/mac/logdna.gz'
            , upload_macver: 'aws s3 cp ./version s3://repo.logdna.com/mac/version'
            , upload_pkg: 'aws s3 cp ./logdna-cli.pkg s3://repo.logdna.com/mac/logdna-cli.pkg'
            , fpm_rpm: 'fpm -s dir -t rpm -n logdna-cli -v ' + pkg.version + ' --license MIT --vendor "Answerbook, Inc." --description "LogDNA CLI for Linux" --url http://logdna.com/ -m "<help@logdna.com>" --post-install ./scripts/post-install -f ./logdna=/usr/local/logdna/bin/logdna'
            , fpm_deb: 'fpm -s dir -t deb -n logdna-cli -v ' + pkg.version + ' --license MIT --vendor "Answerbook, Inc." --description "LogDNA CLI for Linux" --url http://logdna.com/ -m "<help@logdna.com>" --post-install ./scripts/post-install -f --deb-no-default-config-files ./logdna=/usr/local/logdna/bin/logdna'
            , cp_rpm: 'cp -f logdna-cli-' + pkg.version + '-1.x86_64.rpm logdna-cli.rpm'
            , cp_deb: 'cp -f logdna-cli_' + pkg.version + '_amd64.deb logdna-cli.deb'
            , gzip_linuxbin: 'gzip -f ./logdna'
            , upload_linuxbin: 'aws s3 cp ./logdna.gz s3://repo.logdna.com/linux/logdna.gz'
            , upload_linuxver: 'aws s3 cp ./version s3://repo.logdna.com/linux/version'
            , upload_rpm: 'aws s3 cp ./logdna-cli.rpm s3://repo.logdna.com/linux/logdna-cli.rpm'
            , upload_deb: 'aws s3 cp ./logdna-cli.deb s3://repo.logdna.com/linux/logdna-cli.deb'
            , choco: 'pushd .\\.builds\\windows & cpack'
            , choco_deb: 'cp logdna.nuspec .builds/windows && cp logdna.exe .builds/windows/tools && cd .builds/windows && dotnet pack NuspecFile=logdna.nuspec --no-build'
        }, copy: {
            nuspec: {
                files: [{
                    src: './logdna.nuspec'
                    , dest: './.builds/windows/'
                }]
            }, winexe: {
                files: [{
                    src: './logdna.exe'
                    , dest: './.builds/windows/tools/'
                }]
            }
        }, eslint: {
            target: files
            , options: {
                configFile: '.eslintrc'
                , fix: true
            }
        }
    });
    grunt.registerTask('test', ['eslint']);
    grunt.registerTask('build', ['lineremover', 'exec:nexe_win', 'exec:save_version']);
    grunt.registerTask('linux', ['build', 'exec:fpm_rpm', 'exec:fpm_deb', 'exec:cp_rpm', 'exec:cp_deb', 'exec:gzip_linuxbin', 'exec:upload_linuxbin', 'exec:upload_linuxver', 'exec:upload_rpm', 'exec:upload_deb']);
    grunt.registerTask('mac', ['build', 'exec:fpm_osxpkg', 'exec:sign_pkg', 'exec:rm_unsignedpkg', 'exec:gzip_macbin', 'exec:upload_macbin', 'exec:upload_macver', 'exec:upload_pkg']); // 'exec:verify_pkg', 'exec:install_pkg'
    grunt.registerTask('windows', ['build', 'copy:nuspec', 'copy:winexe', 'exec:choco_deb']);
};
