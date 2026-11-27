{
  description = "autobahn-action / Autobahn WebSocket testsuite as a GitHub Action";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs @ {flake-parts, ...}:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      perSystem = {pkgs, ...}: let
        lib = pkgs.lib;
        isLinux = pkgs.stdenv.hostPlatform.isLinux;
        pkgsMusl =
          if isLinux
          then pkgs.pkgsMusl
          else null;

        pnpm = pkgs.callPackage ./nix/pnpm.nix {};
        pnpmMusl =
          if isLinux
          then pkgsMusl.callPackage ./nix/pnpm.nix {}
          else null;

        mkDevShell = packagePkgs: pnpmPackage:
          packagePkgs.mkShell {
            packages = [
              packagePkgs.nodejs_24
              packagePkgs.typescript
              packagePkgs.typescript-language-server
              packagePkgs.ripgrep
              packagePkgs.alejandra
              pnpmPackage
            ];
            shellHook = ''
              echo "autobahn-action dev shell: node $(node --version), pnpm $(pnpm --version)"
            '';
          };
      in {
        formatter = pkgs.alejandra;

        devShells =
          {
            default = mkDevShell pkgs pnpm;
          }
          // lib.optionalAttrs isLinux {
            musl = mkDevShell pkgsMusl pnpmMusl;
          };

        checks.format =
          pkgs.runCommand "check-format" {
            nativeBuildInputs = [pkgs.alejandra];
          } ''
            alejandra --check $(find ${./.} -name '*.nix' ! -path '*/node_modules/*')
            touch $out
          '';
      };
    };
}
