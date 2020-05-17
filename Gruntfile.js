// External Modules
const grunt = require('grunt');
const os = require('os');
const path = require('path');

// Internal Modules
const pkg = require('./package.json');

// Constants
const execOutputPath = `./builds/${os.platform() !== 'win32' ? 'logdna' : 'logdna.exe'}`;
const files = ['./index.js', './Gruntfile.js', 'lib/**/*.js', 'test/**/*.js'];
const fpm = {
    input_type: 'dir'
    , output_type: {
        debian: 'deb'
        , redhat: 'rpm'
        , darwin: 'osxpkg'
    }, name: 'logdna-cli'
    , version: pkg.version
    , license: 'MIT'
    , vendor: '\"LogDNA, Inc.\"'
    , description: {
        linux: '\"LogDNA CLI for Linux\"'
        , darwin: '\"LogDNA CLI for OSX\"'
    }, url: 'https://logdna.com'
    , maintainer: 'support@logdna.com'
};
const nodeVersion = '12.13.0';
const unixSystems = ['darwin', 'debian', 'redhat'];

// Initializations
require('load-grunt-tasks')(grunt);

module.exports = function(grunt) {
    grunt.initConfig({
        lineremover: {
            nukebrowser: {
                files: {
                    'node_modules/ws/package.json': path.join('node_modules', 'ws', 'package.json')
                }, options: {
                    exclusionPattern: /browser/
                }
            }
        }, exec: {
            nexe: {
                cmd: `nexe -i index.js -o ${execOutputPath} -ftr ${nodeVersion}`
                , maxBuffer: 20000 * 1024
            }, fpm_debian: `fpm \
                --input-type ${fpm.input_type} \
                --output-type ${fpm.output_type.debian} \
                --name ${fpm.name} \
                --version ${fpm.version} \
                --license  ${fpm.license} \
                --vendor ${fpm.vendor} \
                --description ${fpm.description.linux} \
                --maintainer ${fpm.maintainer} \
                --post-install ./scripts/post-install \
                -f --deb-no-default-config-files ${execOutputPath}=/usr/local/logdna/bin/logdna`
            , fpm_redhat: `fpm \
                --input-type ${fpm.input_type} \
                --output-type ${fpm.output_type.redhat} \
                --name ${fpm.name} \
                --version ${fpm.version} \
                --license  ${fpm.license} \
                --vendor ${fpm.vendor} \
                --description ${fpm.description.linux} \
                --maintainer ${fpm.maintainer} \
                --post-install ./scripts/post-install \
                -f ${execOutputPath}=/usr/local/logdna/bin/logdna`
            , fpm_darwin: `fpm \
                --input-type ${fpm.input_type} \
                --output-type ${fpm.output_type.darwin} \
                --name ${fpm.name} \
                --version ${fpm.version} \
                --license  ${fpm.license} \
                --vendor ${fpm.vendor} \
                --description ${fpm.description.linux} \
                --maintainer ${fpm.maintainer} \
                --osxpkg-identifier-prefix com.logdna \
                --post-install ./scripts/post-install \
                -f ${execOutputPath}=/usr/local/logdna/bin/logdna`
            , copy_debian: `cp -f logdna-cli*${fpm.version}*.deb ./builds/logdna-cli.deb`
            , copy_redhat: `cp -f logdna-cli*${fpm.version}*.rpm ./builds/logdna-cli.rpm`
            , sign_pkg: `productsign --sign "Developer ID Installer: Answerbook, Inc. (TT7664HMU3)" logdna-cli-${fpm.version}.pkg ./builds/logdna-cli.pkg`
            , verify_pkg: 'spctl --assess --type install -v ./builds/logdna-cli.pkg'
            , gzip_macbin: 'gzip -kf ./logdna'
            , upload_macbin: 'aws s3 cp ./logdna.gz s3://repo.logdna.com/mac/logdna.gz'
            , upload_macver: 'aws s3 cp ./version s3://repo.logdna.com/mac/version'
            , upload_pkg: 'aws s3 cp ./logdna-cli.pkg s3://repo.logdna.com/mac/logdna-cli.pkg'
            , gzip_linuxbin: 'gzip -f ./logdna'
            , upload_linuxbin: 'aws s3 cp ./logdna.gz s3://repo.logdna.com/linux/logdna.gz'
            , upload_linuxver: 'aws s3 cp ./version s3://repo.logdna.com/linux/version'
            , upload_rpm: 'aws s3 cp ./logdna-cli.rpm s3://repo.logdna.com/linux/logdna-cli.rpm'
            , upload_deb: 'aws s3 cp ./logdna-cli.deb s3://repo.logdna.com/linux/logdna-cli.deb'
            , choco: 'pushd .\\.builds\\windows & cpack'
        }, copy: {
            nuspec: {
                files: [{
                    src: './scripts/logdna.nuspec'
                    , dest: './.builds/windows/'
                }]
            }, winexe: {
                files: [{
                    src: './builds/logdna.exe'
                    , dest: './.builds/windows/tools/'
                }]
            }
        }
    });

    grunt.registerTask('build', ['lineremover', 'exec:nexe']);
    // NEW
    grunt.registerTask('debian', ['build', 'exec:fpm_debian', 'exec:copy_debian']);
    grunt.registerTask('redhat', ['build', 'exec:fpm_redhat', 'exec:copy_redhat']);
    grunt.registerTask('darwin', ['build', 'exec:fpm_darwin', 'exec:sign_pkg', 'exec:verify_pkg']);
    // OLD
    grunt.registerTask('linux', ['build', 'exec:fpm_debian', 'exec:copy_debian', 'exec:fpm_redhat', 'exec:copy_redhat', 'exec:gzip_linuxbin', 'exec:upload_linuxbin', 'exec:upload_linuxver', 'exec:upload_rpm', 'exec:upload_deb']);
    grunt.registerTask('mac', ['build', 'exec:fpm_darwin', 'exec:sign_pkg', 'exec:gzip_macbin', 'exec:upload_macbin', 'exec:upload_macver', 'exec:upload_pkg']); // 'exec:verify_pkg', 'exec:install_pkg'
    grunt.registerTask('windows', ['build', 'copy:nuspec', 'copy:winexe', 'exec:choco']);
};
