let fs = require("fs-extra");
let path = require("path");
let childProcess = require("child_process");
let game = require("./game");

function writeFileSyncRecursive(filename, content, charset) {
  filename
    .split(path.sep)
    .slice(0, -1)
    .reduce((last, folder) => {
      let folderPath = last ? last + path.sep + folder : folder;
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
      return folderPath;
    });

  fs.writeFileSync(filename, content, charset);
}

if (!fs.existsSync("config.js")) {
  fs.writeFileSync("config.js", fs.readFileSync("config-default.js"));
}
let config = require("./config");

console.log("Dev service started");

const getBinaryDir = () => path.resolve(__dirname, "../../build");
const getSourceDir = () => path.resolve(__dirname, "../..");

console.log(`Binary dir is '${getBinaryDir()}'`);
console.log(`Source dir is '${getSourceDir()}'`);

let bin = path.join(getBinaryDir(), "_platform_se");
let sourceDir = path.join(getSourceDir());

const watchCallback = (_eventType, fileName) => {
  {
    if (fileName === "touch_Release" || fileName === "touch_Debug") {
      let buildCfg = fileName === "touch_Release" ? "Release" : "Debug";

      console.log("Skyrim Platform " + buildCfg + " x64 updated.");

      if (!process.env.DEV_SERVICE_NO_GAME) {
        console.log("Stopping Skyrim SE...");
        game.kill();
      }

      if (fs.existsSync("./dist")) {
        fs.removeSync("./dist");
      }
      if (!fs.existsSync("./dist")) {
        while (true)
          try {
            fs.mkdirSync("./dist");
            break;
          } catch (e) {
            if (e.toString().indexOf("EPERM") === -1) {
              throw e;
            }
          }
      }
      let getFileName = (p) => p.replace(/^.*[\\\/]/, "");
      let cp = (from, targetDir) =>
        writeFileSyncRecursive(
          path.join(targetDir, getFileName(from)),
          fs.readFileSync(from)
        );
      let binPath = (file) => path.join(bin, `bin/${buildCfg}/${file}`);

      let cefDir = fs
        .readFileSync(path.join(bin, `cef_dir.txt`))
        .toString("utf-8");
      [
        "chrome_elf.dll",
        "d3dcompiler_47.dll",
        "libcef.dll",
        "libEGL.dll",
        "libGLESv2.dll",
        "snapshot_blob.bin",
        "v8_context_snapshot.bin",
      ].forEach((item, i) => {
        cp(
          path.join(cefDir, "Release", item),
          "./dist/Data/Platform/Distribution/RuntimeDependencies"
        );
      });
      ["libEGL.dll", "libGLESv2.dll"].forEach((item, i) => {
        cp(
          path.join(cefDir, "Release/swiftshader", item),
          "./dist/Data/Platform/Distribution/RuntimeDependencies/swiftshader"
        );
      });
      ["icudtl.dat"].forEach((item, i) => {
        cp(
          path.join(cefDir, "Resources", item),
          "./dist/Data/Platform/Distribution/RuntimeDependencies"
        );
      });
      [
        "cef.pak",
        "cef_100_percent.pak",
        "cef_200_percent.pak",
        "cef_extensions.pak",
        "devtools_resources.pak",
      ].forEach((item, i) => {
        cp(
          path.join(cefDir, "Resources", item),
          "./dist/Data/Platform/Distribution/CEF"
        );
      });
      fs.copySync(
        path.join(cefDir, "Resources/locales"),
        "./dist/Data/Platform/Distribution/CEF/locales"
      );

      cp(binPath("SkyrimPlatform.pdb"), "./dist");
      cp(binPath("SkyrimPlatformImpl.pdb"), "./dist");
      cp(
        binPath("ChakraCore.dll"),
        "./dist/Data/Platform/Distribution/RuntimeDependencies"
      );
      cp(
        binPath("SkyrimPlatformCEF.exe"),
        "./dist/Data/Platform/Distribution/RuntimeDependencies"
      );
      cp(binPath("SkyrimPlatformCEF.pdb"), "./dist");
      cp(binPath("SkyrimPlatform.dll"), "./dist/Data/SKSE/Plugins");
      cp(
        binPath("SkyrimPlatformImpl.dll"),
        "./dist/Data/Platform/Distribution/RuntimeDependencies"
      );
      [
        "Actor",
        "ActorBase",
        "Cell",
        "ColorForm",
        "Enchantment",
        "Form",
        "HeadPart",
        "ObjectReference",
        "Potion",
        "Race",
        "Actor",
        "TESModPlatform",
        "WorldSpace",
      ].forEach((script) =>
        cp(
          path.join(sourceDir, `src/platform_se/pex/${script}.pex`),
          "./dist/Data/Scripts"
        )
      );
      cp(
        path.join(bin, `_codegen/skyrimPlatform.ts`),
        "./dist/Data/Platform/Modules"
      );
      cp(
        path.join(sourceDir, "tools/system_polyfill/dist/___systemPolyfill.js"),
        "./dist/Data/Platform/Distribution"
      );
      fs.copySync(
        path.join(sourceDir, "tools/plugin-example"),
        "./dist/Data/Platform/plugin-example"
      );
      fs.copySync(path.join(sourceDir, "requirements"), "./dist");
      fs.removeSync("./dist/Data/Platform/plugin-example/node_modules");
      fs.removeSync("./dist/Data/Platform/plugin-example/dist");

      if (!process.env.DEV_SERVICE_NO_GAME) {
        fs.copySync("./dist", config.SkyrimSEFolder);
      }

      // No need to release pdb to the public
      fs.unlinkSync("./dist/SkyrimPlatform.pdb");
      fs.unlinkSync("./dist/SkyrimPlatformCEF.pdb");
      fs.unlinkSync("./dist/SkyrimPlatformImpl.pdb");

      if (!process.env.DEV_SERVICE_NO_GAME) {
        console.log(`Starting ${config.SkyrimSEFolder}`);
        game.launch(config.SkyrimSEFolder).catch((e) => console.error(e));
      }
    }
  }
};

if (process.env.DEV_SERVICE_ONLY_ONCE) {
  const defaultConfig =
    process.env.DEFAULT_CONFIG === "Debug" ? "Debug" : "Release";
  watchCallback(undefined, `touch_${defaultConfig}`);
} else {
  console.log(`Watching for changes in ${bin}`);
  fs.watch(bin, watchCallback);
}
