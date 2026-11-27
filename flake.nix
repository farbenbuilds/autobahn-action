{
  description = "autobahn-action / Autobahn WebSocket testsuite as a GitHub Action";

  inputs = {
    # Keep this lock aligned with the sibling ventiws flake so a musl host
    # reuses the Node and pnpm store paths instead of rebuilding them.
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

        # `nodejs` rather than `nodejs_24` matches the sibling ventiws pin and
        # its cached musl build. The shared pin carries 24.21.0, which predates
        # the October 2026 security release; CI uses 24.22.1 until nixpkgs
        # carries a cached musl build of the fixed release.
        mkDevShell = packagePkgs: pnpmPackage: extraPackages:
          packagePkgs.mkShell {
            packages = [packagePkgs.nodejs pnpmPackage] ++ extraPackages;
            shellHook = ''
              echo "autobahn-action dev shell: node $(node --version), pnpm $(pnpm --version)"
            '';
          };
      in {
        formatter = pkgs.alejandra;

        devShells =
          {
            default = mkDevShell pkgs pnpm [
              pkgs.typescript
              pkgs.typescript-language-server
              pkgs.ripgrep
              pkgs.alejandra
            ];
          }
          // lib.optionalAttrs isLinux {
            # Keep the musl shell to the cached Node and pnpm closure. The extra
            # glibc host tools are not runnable there and would force a full
            # musl bootstrap to build.
            musl = mkDevShell pkgsMusl pnpmMusl [];
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
