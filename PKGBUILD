#Maintainer:xgdgsc<xgdgsc@gmail.com>

pkgname=mendeleydesktop-chs
_pkgname=mendeleydesktop
pkgver=1.12.3
pkgrel=1
pkgdesc="Academic software for managing and sharing research papers (desktop client)"
url=http://www.mendeley.com/release-notes/
arch=(i686 x86_64)
depends=(python2 qtwebkit)
conflicts=mendeleydesktop
license=(custom:mendeley_eula)
install=mendeleydesktop.install
md5sums=('' '16358cd53dc258a72efcaeab5a415217')


if [[ $CARCH = i686 ]];then
  _arch=i486
  md5sums[0]='f244e9f54ab6e3969078cd8e68fc6779'

else
  _arch=$CARCH
  md5sums[0]='da8bc0de6790bae30991c6f37da7dbab'
fi

if which gconftool-2 &>/dev/null;then
  depends=(${depends[@]} gconf)
fi

#http://desktop-download.mendeley.com/download/linux/mendeleydesktop-1.12-linux-i486.tar.bz2
source=("http://desktop-download.mendeley.com/download/linux/$_pkgname-$pkgver-linux-$_arch.tar.bz2"
        'mendeleydesktop.install'
        'lookup-popover.css'
        'lookup-popover.js'
        'wikipedia.js'
        )

package() {
    cd "$_pkgname-$pkgver-linux-$_arch"
    cp $srcdir/../lookup-popover.js \
       $srcdir/../lookup-popover.css\
       $srcdir/../wikipedia.js \
       share/mendeleydesktop/webContent/notes/

    rm -f share/doc/mendeleydesktop/*.txt

    install -dm755 "$pkgdir/opt/$_pkgname/"
    mv bin lib share "$pkgdir/opt/$_pkgname/"
    #ln -s "../lib/mendeleydesktop/libexec/mendeleydesktop.$_arch" "$pkgdir/opt/$pkgname/bin/$pkgname"
    cd "$pkgdir"
    sed -i '1s@^#!/usr/bin/python$@&2@' opt/"$_pkgname"/bin/mendeleydesktop
    #install -Dm755 "bin/mendeleydesktop" "$pkgdir/usr/bin/mendeleydesktop"
    install -dm755 "$pkgdir"/usr/bin
    ln -s /opt/"$_pkgname"/bin/mendeleydesktop "$pkgdir/usr/bin/mendeleydesktop"

    cd "$srcdir/$_pkgname-$pkgver-linux-$_arch"
    install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$_pkgname/LICENSE"

    install -dm755 "$pkgdir"/usr/share/applications
    ln -s /opt/"$_pkgname"/share/applications/mendeleydesktop.desktop "$pkgdir"/usr/share/applications/

    #Romove bundled Qt from package
    cat << __EOF__
Removing bundled Qt library.
If you used "--force-bundled-qt" to start mendeley,
make sure you remove any old versions of ".desktop" file of mendeley in ~/.local/share/applications/,
because mendeley will automatically create one there.
__EOF__
    rm -rf "$pkgdir"/opt/"$_pkgname"/lib/qt

    #Remove unneeded lines if gconf is not installed.
    if ! which gconftool-2 &>/dev/null;then
    sed -i '6d;74d;75d' \
        "$pkgdir"/opt/"$_pkgname"/bin/install-mendeley-link-handler.sh
    fi
    #force mendeley to use bundled qt because which under qt 4.8 crashes at start point
    #make sure you remove any old versions of ".desktop" file of mendeley in ~/.local/share/applications/
#    sed -i 's/^Exec.*$/& --force-bundled-qt/' "$pkgdir"/opt/"$pkgname"/share/applications/mendeleydesktop.desktop
    for size in 16 22 32 48 64 128;do
        install -dm755 "$pkgdir"/usr/share/icons/hicolor/${size}x${size}/apps
        ln -s /opt/"$_pkgname"/share/icons/hicolor/${size}x${size}/apps/"${_pkgname}".png \
          "$pkgdir"/usr/share/icons/hicolor/${size}x${size}/apps
    done
}
